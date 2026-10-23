import type {
	ReviewQueueItem,
	ReviewQueueResponse,
	ReviewSubmissionRequest,
	ReviewSubmissionResponse,
} from '@unbound-app/contracts/review';
import type { ReviewDecision, SubmissionKind } from '@unbound-app/contracts/publish';
import { submissionKindSchema } from '@unbound-app/contracts/publish';
import { and, eq } from 'drizzle-orm';

import { addon, addonMaintainer, addonVersion, submission, user } from '~/db/schema';
import { LATEST_VERSION, refreshAddonSummary, toAddonSummary } from '~/lib/addons';
import { getArtifactKeys, toAddonVersion } from '~/lib/artifacts';
import { recordReviewDecision } from '~/lib/moderation-events';
import type { SubmissionRow } from '~/lib/submissions';
import { requirePermission } from '~/lib/api/caller';
import type { Permissions } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';
import { toSubmission } from '~/lib/submissions';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';

export type AddonVersionInsert = typeof addonVersion.$inferInsert;

type Decision = {
	decision: ReviewDecision;
	note: string | null;
	reviewerId: string;
	reviewedAt: Date;
};

const REVIEW_PERMISSIONS: Record<SubmissionKind, Permissions> = {
	listing: { submission: ['review'] },
	update: { update: ['review'] },
};

function getReviewableKinds(caller: Caller): SubmissionKind[] {
	return submissionKindSchema.options.filter((kind) =>
		hasPermission(caller.user.role, REVIEW_PERMISSIONS[kind]),
	);
}

/**
 * @description Builds the live version row an approved submission publishes.
 * @param row The approved submission.
 * @param sha256 The verified SHA-256 of the published bundle.
 * @param publishedAt The approval time.
 * @returns The `addon_version` values.
 */
export function toVersionRow(
	row: SubmissionRow,
	sha256: string,
	publishedAt: Date,
): AddonVersionInsert {
	const min = row.manifest.unbound?.min;

	return {
		addonId: row.addonId,
		version: row.version,
		versionKey: toVersionKey(row.version),
		minClientKey: min ? toVersionKey(min) : '',
		submissionId: row.id,
		manifest: row.manifest,
		changelog: row.changelog,
		bundleSize: row.bundleSize,
		sha256,
		publishedAt,
	};
}

/**
 * @description Lists the submissions waiting for review that the caller may review, oldest first,
 * each with its submitter, the addon's newest approved version and a presigned download of the
 * staged bundle.
 * @param ctx The application context.
 * @param caller The reviewer.
 * @param kind Only list new listings or only updates.
 * @returns The queue.
 */
export async function listReviewQueue(
	ctx: AppContext,
	caller: Caller,
	kind?: SubmissionKind,
): Promise<ReviewQueueResponse> {
	const kinds = getReviewableKinds(caller).filter((candidate) => !kind || candidate === kind);

	if (kinds.length === 0) {
		throw new ApiError('forbidden', 'You do not have permission to review these submissions.');
	}

	const rows = await ctx.db.query.submission.findMany({
		where: { status: 'pending_review', kind: { in: kinds } },
		with: { author: { columns: { id: true, name: true, image: true } } },
		orderBy: { submittedAt: 'asc' },
	});

	if (rows.length === 0) {
		return { submissions: [] };
	}

	const updated = rows.filter((row) => row.kind === 'update').map((row) => row.addonId);
	const [addons, memberships] = await Promise.all([
		ctx.db.query.addon.findMany({
			where: { id: { in: updated } },
			with: LATEST_VERSION,
		}),
		ctx.db.query.addonMaintainer.findMany({
			where: { userId: caller.user.id, addonId: { in: rows.map((row) => row.addonId) } },
			columns: { addonId: true },
		}),
	]);

	const previous = new Map(addons.map((entry) => [entry.id, entry.versions[0]]));
	const maintained = new Set(memberships.map((membership) => membership.addonId));
	const expiresIn = ctx.env.REVIEW_ARTIFACT_URL_TTL_SECONDS;
	const expiresAt = new Date(ctx.now().getTime() + expiresIn * 1000).toISOString();

	const submissions = rows.map((row): ReviewQueueItem => {
		const { author, sha256, submittedAt } = row;
		const version = previous.get(row.addonId);

		if (!author || !sha256 || !submittedAt) {
			throw new Error(`Submission ${row.id} is pending review without an author or upload.`);
		}

		return {
			submission: toSubmission(row),
			manifest: row.manifest,
			changelog: row.changelog,
			bundleSize: row.bundleSize,
			sha256,
			submittedAt: submittedAt.toISOString(),
			submitter: { id: author.id, name: author.name, image: author.image ?? null },
			selfReview: author.id === caller.user.id || maintained.has(row.addonId),
			previousVersion: version ? toAddonVersion(ctx.env, version) : null,
			artifact: {
				url: ctx.storage.staging.presign(row.stagingKey, { method: 'GET', expiresIn }),
				expiresAt,
			},
		};
	});

	return { submissions };
}

async function requirePendingReview(
	ctx: AppContext,
	caller: Caller,
	id: string,
): Promise<SubmissionRow> {
	if (getReviewableKinds(caller).length === 0) {
		throw new ApiError('forbidden', 'You do not have permission to review submissions.');
	}

	const row = await ctx.db.query.submission.findFirst({ where: { id } });

	if (!row) {
		throw new ApiError('not_found', `Submission ${id} does not exist.`);
	}

	requirePermission(caller, REVIEW_PERMISSIONS[row.kind]);

	if (row.status !== 'pending_review') {
		throw new ApiError('submission_not_pending', `Submission ${id} is ${row.status}.`);
	}

	const maintainer = await ctx.db.query.addonMaintainer.findFirst({
		where: { addonId: row.addonId, userId: caller.user.id },
		columns: { role: true },
	});

	if (row.authorId === caller.user.id || maintainer) {
		throw new ApiError('self_review', `You cannot review ${row.addonId}: you maintain it.`);
	}

	return row;
}

// Re-checks the staged bundle against the size limit and the size and SHA-256 recorded on finalize
// (the upload URL stays reusable until it expires), then publishes it and its manifest.
async function publishArtifact(ctx: AppContext, row: SubmissionRow): Promise<string> {
	const staged = ctx.storage.staging.file(row.stagingKey);

	if (!(await staged.exists())) {
		throw new ApiError('artifact_mismatch', `The staged bundle of ${row.id} is missing.`);
	}

	const bundle = await staged.bytes();
	const sha256 = new Bun.CryptoHasher('sha256').update(bundle).digest('hex');

	if (
		bundle.byteLength > ctx.env.ADDON_MAX_BYTES ||
		bundle.byteLength !== row.bundleSize ||
		sha256 !== row.sha256
	) {
		throw new ApiError(
			'artifact_mismatch',
			`The staged bundle of ${row.id} changed after it was finalized.`,
		);
	}

	const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);

	await Promise.all([
		ctx.storage.public.write(keys.bundle, bundle),
		ctx.storage.public.write(keys.manifest, JSON.stringify(row.manifest), {
			type: 'application/json',
		}),
	]);

	return sha256;
}

/**
 * Records the decision on a submission still pending review; anything else means another reviewer
 * decided first. Approval goes live in the same transaction, after its files are public.
 */
function decide(
	ctx: AppContext,
	row: SubmissionRow,
	decision: Decision,
	sha256?: string,
): SubmissionRow {
	return ctx.db.transaction(
		(tx) => {
			const updated = tx
				.update(submission)
				.set({
					status: decision.decision,
					reviewDecision: decision.decision,
					reviewNote: decision.note,
					reviewerId: decision.reviewerId,
					reviewedAt: decision.reviewedAt,
				})
				.where(and(eq(submission.id, row.id), eq(submission.status, 'pending_review')))
				.returning()
				.get();

			if (!updated) {
				throw new ApiError(
					'submission_not_pending',
					`Submission ${row.id} was already reviewed.`,
				);
			}

			recordReviewDecision(tx, updated);

			if (!sha256) {
				return updated;
			}

			if (row.kind === 'listing') {
				tx.insert(addon)
					.values({
						id: row.addonId,
						createdAt: decision.reviewedAt,
						...toAddonSummary(row.manifest, decision.reviewedAt),
					})
					.run();
				tx.insert(addonMaintainer)
					.values({
						addonId: row.addonId,
						userId: row.authorId,
						role: 'owner',
						createdAt: decision.reviewedAt,
					})
					.run();

				const author = tx
					.select({ role: user.role })
					.from(user)
					.where(eq(user.id, row.authorId))
					.get();

				if (author && !hasPermission(author.role, { update: ['create'] })) {
					tx.update(user)
						.set({ role: 'developer' })
						.where(eq(user.id, row.authorId))
						.run();
				}
			}

			tx.insert(addonVersion)
				.values(toVersionRow(row, sha256, decision.reviewedAt))
				.run();

			if (row.kind === 'update') {
				refreshAddonSummary(tx, row.addonId);
			}

			return updated;
		},
		{ behavior: 'immediate' },
	);
}

/**
 * @description Approves, rejects or requests changes on a pending submission. Reviewers need the
 * review permission for its kind and may not maintain the addon. Approval re-verifies the staged
 * bundle, publishes it to `addons/{id}/{version}/`, then in one transaction marks the submission
 * approved and writes the live version (plus, for a first listing, the addon, its owner and the
 * author's `developer` role); the staged bundle is deleted last. Rejection deletes the staged bundle,
 * which also frees a new listing's id. Requesting changes keeps it until the author republishes.
 * @param ctx The application context.
 * @param caller The reviewer.
 * @param id The submission id.
 * @param request The decision and its note.
 * @returns The reviewed submission.
 */
export async function reviewSubmission(
	ctx: AppContext,
	caller: Caller,
	id: string,
	request: ReviewSubmissionRequest,
): Promise<ReviewSubmissionResponse> {
	const row = await requirePendingReview(ctx, caller, id);
	const decision: Decision = {
		decision: request.decision,
		note: request.note ?? null,
		reviewerId: caller.user.id,
		reviewedAt: ctx.now(),
	};

	const sha256 = request.decision === 'approved' ? await publishArtifact(ctx, row) : undefined;
	const reviewed = decide(ctx, row, decision, sha256);

	if (request.decision !== 'changes_requested') {
		await ctx.storage.staging.delete(row.stagingKey);
	}

	return { submission: toSubmission(reviewed) };
}

export default { toVersionRow, listReviewQueue, reviewSubmission };
