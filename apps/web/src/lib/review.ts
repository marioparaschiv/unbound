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
import type { SourcedSubmissionRow, SubmissionRow } from '~/lib/submissions';
import { createGitHubClient, getGitHubToken } from '~/lib/github';
import { requireSourced, toSubmission } from '~/lib/submissions';
import { toAddonVersion, writeArtifact } from '~/lib/artifacts';
import { recordReviewDecision } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import type { Permissions } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';
import type { Transaction } from '~/db/database';
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
 * each with its source and content, its submitter, the addon's newest approved version and ADDON.md,
 * and a presigned download of the staged bundle.
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
		with: { author: { columns: { id: true, name: true, image: true } }, source: true },
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

	const submissions = rows.map((loaded): ReviewQueueItem => {
		const row = requireSourced(loaded);
		const { author, source, sha256, submittedAt } = row;
		const version = previous.get(row.addonId);

		if (!author || !submittedAt) {
			throw new Error(`Submission ${row.id} is pending review without an author.`);
		}

		const submission = toSubmission(row);

		return {
			submission,
			source: submission.source,
			manifest: row.manifest,
			bundleSize: row.bundleSize,
			sha256,
			addonMd: source.addonMd,
			changelog: source.changelog,
			details: source.details,
			submittedAt: submittedAt.toISOString(),
			submitter: { id: author.id, name: author.name, image: author.image ?? null },
			selfReview: author.id === caller.user.id || maintained.has(row.addonId),
			previousVersion: version ? toAddonVersion(ctx.env, version, version.submission) : null,
			previousAddonMd: version?.submission?.source?.addonMd ?? null,
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
): Promise<SourcedSubmissionRow> {
	if (getReviewableKinds(caller).length === 0) {
		throw new ApiError('forbidden', 'You do not have permission to review submissions.');
	}

	const row = await ctx.db.query.submission.findFirst({ where: { id }, with: { source: true } });

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

	return requireSourced(row);
}

// b2/staging-lifecycle.json hides staged objects after 14 days, so re-read the pinned blob
// instead of failing.
async function refetchBundle(ctx: AppContext, row: SourcedSubmissionRow): Promise<Uint8Array> {
	// The repository is public, so an author whose GitHub link lapsed must not block the approval.
	const token = await getGitHubToken(ctx, row.authorId).catch(() => undefined);
	const github = createGitHubClient(ctx.env, token ?? null);

	return github.readBlob(row.repository, row.source.bundleBlobSha);
}

async function publishArtifact(ctx: AppContext, row: SourcedSubmissionRow): Promise<string> {
	const staged = ctx.storage.staging.file(row.stagingKey);
	const bundle = (await staged.exists()) ? await staged.bytes() : await refetchBundle(ctx, row);
	const sha256 = new Bun.CryptoHasher('sha256').update(bundle).digest('hex');

	if (
		bundle.byteLength > ctx.env.ADDON_MAX_BYTES ||
		bundle.byteLength !== row.bundleSize ||
		sha256 !== row.sha256
	) {
		throw new ApiError(
			'artifact_mismatch',
			`The bundle of ${row.id} no longer matches what was submitted.`,
		);
	}

	await writeArtifact(ctx, row, bundle);

	return sha256;
}

/**
 * @description Makes an approved submission's version live, inside the approval's transaction: a
 * listing creates the addon with the author as owner, an update moves the addon to the submitted
 * repository and refreshes its summary.
 * @param tx The approval's transaction.
 * @param row The approved submission.
 * @param sha256 The verified SHA-256 of the published bundle.
 * @param publishedAt The approval time.
 * @returns Resolves once the version is live.
 */
export async function publishVersion(
	tx: Transaction,
	row: SubmissionRow,
	sha256: string,
	publishedAt: Date,
): Promise<void> {
	if (row.kind === 'listing') {
		await tx.insert(addon).values({
			id: row.addonId,
			repository: row.repository,
			createdAt: publishedAt,
			...toAddonSummary(row.manifest, publishedAt),
		});
		await tx.insert(addonMaintainer).values({
			addonId: row.addonId,
			userId: row.authorId,
			role: 'owner',
			createdAt: publishedAt,
		});
	}

	await tx.insert(addonVersion).values(toVersionRow(row, sha256, publishedAt));

	if (row.kind !== 'update') return;

	await tx.update(addon).set({ repository: row.repository }).where(eq(addon.id, row.addonId));
	await refreshAddonSummary(tx, row.addonId);
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
): Promise<SubmissionRow> {
	return ctx.db.transaction(async (tx) => {
		const [updated] = await tx
			.update(submission)
			.set({
				status: decision.decision,
				reviewDecision: decision.decision,
				reviewNote: decision.note,
				reviewerId: decision.reviewerId,
				reviewedAt: decision.reviewedAt,
			})
			.where(and(eq(submission.id, row.id), eq(submission.status, 'pending_review')))
			.returning();

		if (!updated) {
			throw new ApiError(
				'submission_not_pending',
				`Submission ${row.id} was already reviewed.`,
			);
		}

		await recordReviewDecision(tx, updated);

		if (!sha256) {
			return updated;
		}

		await publishVersion(tx, row, sha256, decision.reviewedAt);

		if (row.kind === 'listing') {
			const [author] = await tx
				.select({ role: user.role })
				.from(user)
				.where(eq(user.id, row.authorId));

			if (author && !hasPermission(author.role, { update: ['create'] })) {
				await tx.update(user).set({ role: 'developer' }).where(eq(user.id, row.authorId));
			}
		}

		return updated;
	});
}

/**
 * @description Approves, rejects or requests changes on a pending submission. Reviewers need the
 * review permission for its kind and may not maintain the addon.
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
	const reviewed = await decide(ctx, row, decision, sha256);

	if (request.decision !== 'changes_requested') {
		await ctx.storage.staging.delete(row.stagingKey);
	}

	return {
		submission: toSubmission({
			...reviewed,
			repository: row.repository,
			sha256: row.sha256,
			source: row.source,
		}),
	};
}

export default { toVersionRow, publishVersion, listReviewQueue, reviewSubmission };
