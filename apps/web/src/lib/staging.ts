import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { createLogger } from '@unbound-app/logger';

import type { AppContext, AuthHookContext } from '~/lib/context';
import { OPEN_SUBMISSION_STATUSES } from '~/lib/submissions';
import { startPeriodicJob, type Job } from '~/lib/jobs';
import { appendEvent } from '~/lib/moderation-events';
import { addonVersion, submission } from '~/db/schema';

const logger = createLogger('Web', 'Staging');

const LIST_PAGE_SIZE = 1000;

export type SweepResult = {
	/** Staged objects deleted because no open submission owns them. */
	orphans: number;
};

async function deleteStaged(ctx: AuthHookContext, keys: string[]) {
	await Promise.all(keys.map((key) => ctx.storage.staging.delete(key)));
}

async function deleteOrphans(ctx: AppContext): Promise<number> {
	const settled = ctx.now().getTime() - ctx.env.STAGING_ORPHAN_GRACE_SECONDS * 1000;

	let deleted = 0;
	let startAfter: string | undefined;
	let truncated = true;

	while (truncated) {
		const page = await ctx.storage.staging.list({ startAfter, maxKeys: LIST_PAGE_SIZE });
		const objects = page.contents ?? [];

		if (objects.length === 0) {
			break;
		}

		const keys = objects
			.filter((object) => new Date(object.lastModified ?? 0).getTime() <= settled)
			.map((object) => object.key);

		// An approved submission keeps its bundle until its version's files are published.
		const owned = await ctx.db
			.select({ key: submission.stagingKey })
			.from(submission)
			.leftJoin(
				addonVersion,
				and(
					eq(addonVersion.submissionId, submission.id),
					isNotNull(addonVersion.filesPendingSince),
				),
			)
			.where(
				and(
					inArray(submission.stagingKey, keys),
					or(
						inArray(submission.status, OPEN_SUBMISSION_STATUSES),
						isNotNull(addonVersion.submissionId),
					),
				),
			);

		const kept = new Set(owned.map((row) => row.key));
		const orphans = keys.filter((key) => !kept.has(key));

		await deleteStaged(ctx, orphans);

		deleted += orphans.length;
		startAfter = objects.at(-1)?.key;
		truncated = page.isTruncated ?? false;
	}

	return deleted;
}

/**
 * @description Deletes every staged object no open or unpublished submission owns, except those younger than
 * `STAGING_ORPHAN_GRACE_SECONDS`.
 * @param ctx The application context.
 * @returns How many orphaned objects were deleted.
 */
export async function sweepStaging(ctx: AppContext): Promise<SweepResult> {
	return { orphans: await deleteOrphans(ctx) };
}

/**
 * @description Runs {@link sweepStaging} at boot and every `STAGING_SWEEP_INTERVAL_SECONDS` as a
 * periodic job.
 * @param ctx The application context.
 * @returns The started job.
 */
export function startStagingSweeper(ctx: AppContext): Job {
	return startPeriodicJob(
		ctx.jobs,
		'staging',
		ctx.env.STAGING_SWEEP_INTERVAL_SECONDS,
		async () => {
			const { orphans } = await sweepStaging(ctx);

			if (orphans === 0) return;

			logger.info(`Deleted ${orphans} orphaned objects.`);
		},
	);
}

/**
 * @description Cancels every open submission of a banned user, which releases the addon ids their
 * listings claimed, records a `submission.cancelled` event for each, and deletes their staged objects.
 * @param ctx The application context, as auth hooks get it.
 * @param userId The banned user.
 * @returns How many submissions were cancelled.
 */
export async function purgeUserSubmissions(ctx: AuthHookContext, userId: string): Promise<number> {
	const at = ctx.now();
	const cancelled = await ctx.db.transaction(async (tx) => {
		const rows = await tx
			.update(submission)
			.set({ status: 'cancelled' })
			.where(
				and(
					eq(submission.authorId, userId),
					inArray(submission.status, OPEN_SUBMISSION_STATUSES),
				),
			)
			.returning({
				id: submission.id,
				addonId: submission.addonId,
				kind: submission.kind,
				version: submission.version,
				key: submission.stagingKey,
			});

		for (const row of rows) {
			await appendEvent(tx, {
				subject: { type: 'addon', id: row.addonId },
				actorId: null,
				at,
				kind: 'submission.cancelled',
				data: { submissionId: row.id, submissionKind: row.kind, version: row.version },
			});
		}

		return rows;
	});

	await deleteStaged(
		ctx,
		cancelled.map((row) => row.key),
	);

	return cancelled.length;
}

export default { sweepStaging, startStagingSweeper, purgeUserSubmissions };
