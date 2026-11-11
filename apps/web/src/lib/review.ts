import type {
	ReviewQueueItem,
	ReviewQueueResponse,
	ReviewSubmissionRequest,
	ReviewSubmissionResponse,
} from '@unbound-app/contracts/review';
import { submissionKindSchema } from '@unbound-app/contracts/publish';
import type { SubmissionKind } from '@unbound-app/contracts/publish';
import { isNotNull } from 'drizzle-orm';

import { decideSubmission, type Decision } from '~/lib/submission-decision';
import { requireSourced, toSubmission } from '~/lib/submissions';
import { describeMaintainerChanges } from '~/lib/maintainers';
import type { SourcedSubmissionRow } from '~/lib/submissions';
import { requirePermission } from '~/lib/api/caller';
import type { Permissions } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';
import { toAddonVersion } from '~/lib/artifacts';
import type { AppContext } from '~/lib/context';
import { publish } from '~/lib/publish-version';
import type { Caller } from '~/lib/api/caller';
import { LATEST_VERSION } from '~/lib/addons';
import { readTags } from '~/lib/addon-tags';
import { ApiError } from '~/lib/api/errors';
import { addonVersion } from '~/db/schema';

const REVIEW_PERMISSIONS: Record<SubmissionKind, Permissions> = {
	listing: { submission: ['review'] },
	update: { update: ['review'] },
};

/**
 * @description Says whether the caller's role may review submissions of a kind.
 * @param caller The would-be reviewer.
 * @param kind The submission kind.
 * @returns Whether they may review it.
 */
export function canReview(caller: Caller, kind: SubmissionKind): boolean {
	return hasPermission(caller.user.role, REVIEW_PERMISSIONS[kind]);
}

function getReviewableKinds(caller: Caller): SubmissionKind[] {
	return submissionKindSchema.enum.filter((kind) => canReview(caller, kind));
}

/**
 * @description Lists the submissions waiting for review that the caller may review, oldest first,
 * plus approved ones whose files failed to publish (`submission.status` is `approved`), each with its source and content, its submitter, the addon's newest approved version and ADDON.md,
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

	// An approved submission stays queued while its version's public files are unwritten.
	const unpublished = await ctx.db
		.select({ id: addonVersion.submissionId })
		.from(addonVersion)
		.where(isNotNull(addonVersion.filesPendingSince));
	const rows = await ctx.db.query.submission.findMany({
		where: {
			kind: { in: kinds },
			OR: [
				{ status: 'pending_review' },
				{ id: { in: unpublished.map((entry) => entry.id) } },
			],
		},
		with: { author: { columns: { id: true, name: true, image: true } }, source: true },
		orderBy: { submittedAt: 'asc', id: 'asc' },
	});

	if (rows.length === 0) {
		return { submissions: [] };
	}

	const updated = rows.filter((row) => row.kind === 'update').map((row) => row.addonId);
	const chosen = [...new Set(rows.flatMap((row) => row.tags ?? []))];
	const naming = rows.flatMap(({ id, addonId, maintainers }) =>
		maintainers ? [{ id, addonId, maintainers }] : [],
	);
	const [addons, memberships, tags, maintainerChanges] = await Promise.all([
		ctx.db.query.addon.findMany({
			where: { id: { in: updated } },
			with: LATEST_VERSION,
		}),
		ctx.db.query.addonMaintainer.findMany({
			where: { userId: caller.user.id, addonId: { in: rows.map((row) => row.addonId) } },
			columns: { addonId: true },
		}),
		readTags(ctx, chosen),
		describeMaintainerChanges(ctx, naming),
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
			page: source.page,
			changelog: source.changelog,
			details: source.details,
			submittedAt: submittedAt.toISOString(),
			submitter: { id: author.id, name: author.name, image: author.image ?? null },
			tags: row.tags ? tags.filter((entry) => row.tags?.includes(entry.id)) : null,
			maintainers: maintainerChanges.get(row.id) ?? null,
			icon: row.icon,
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

async function requireReviewable(
	ctx: AppContext,
	caller: Caller,
	id: string,
	request: ReviewSubmissionRequest,
): Promise<SourcedSubmissionRow> {
	if (getReviewableKinds(caller).length === 0) {
		throw new ApiError('forbidden', 'You do not have permission to review submissions.');
	}

	const row = await ctx.db.query.submission.findFirst({ where: { id }, with: { source: true } });

	if (!row) {
		throw new ApiError('not_found', `Submission ${id} does not exist.`);
	}

	requirePermission(caller, REVIEW_PERMISSIONS[row.kind]);

	// An approved submission may be approved again: publishing then writes the files a failed write left pending.
	const republish = request.decision === 'approved' && row.status === 'approved';

	if (row.status !== 'pending_review' && !republish) {
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

/**
 * @description Approves, rejects or requests changes on a pending submission. Reviewers need the
 * review permission for its kind and may not maintain the addon. Repeating an approval that committed
 * but failed to publish its files writes them again, whichever reviewer repeats it.
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
	const row = await requireReviewable(ctx, caller, id, request);
	const decision: Decision = {
		decision: request.decision,
		note: request.note ?? null,
		reviewerId: caller.user.id,
		reviewedAt: ctx.now(),
	};
	const reviewed =
		request.decision === 'approved'
			? ((await publish(ctx, { mode: 'review', row, decision })).row ?? row)
			: await ctx.db.transaction((tx) => decideSubmission(tx, row, decision));

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

export default { canReview, listReviewQueue, reviewSubmission };
