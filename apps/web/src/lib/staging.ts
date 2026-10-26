import { createLogger } from '@unbound-app/logger';
import { and, eq, inArray } from 'drizzle-orm';

import { OPEN_SUBMISSION_STATUSES } from '~/lib/submissions';
import { appendEvent } from '~/lib/moderation-events';
import type { AppContext } from '~/lib/context';
import { submission } from '~/db/schema';

const logger = createLogger('Web', 'Staging');

const LIST_PAGE_SIZE = 1000;

export type StagingContext = Pick<AppContext, 'db' | 'storage'>;

export type SweepResult = {
	/** Staged objects deleted because no open submission owns them. */
	orphans: number;
};

async function deleteStaged(ctx: StagingContext, keys: string[]) {
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

		const owned = await ctx.db
			.select({ key: submission.stagingKey })
			.from(submission)
			.where(
				and(
					inArray(submission.stagingKey, keys),
					inArray(submission.status, OPEN_SUBMISSION_STATUSES),
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
 * @description Deletes every staged object no open submission owns, except those younger than
 * `STAGING_ORPHAN_GRACE_SECONDS`.
 * @param ctx The application context.
 * @returns How many orphaned objects were deleted.
 */
export async function sweepStaging(ctx: AppContext): Promise<SweepResult> {
	return { orphans: await deleteOrphans(ctx) };
}

/**
 * @description Runs {@link sweepStaging} every `STAGING_SWEEP_INTERVAL_SECONDS` for the life of the
 * process. A failed sweep is logged and retried on the next tick.
 * @param ctx The application context.
 * @returns The interval timer, for `clearInterval`.
 */
export function startStagingSweeper(ctx: AppContext): Timer {
	async function sweep() {
		try {
			const { orphans } = await sweepStaging(ctx);

			if (orphans === 0) return;

			logger.info(`Deleted ${orphans} orphaned objects.`);
		} catch (error) {
			logger.error('Failed to sweep the staging bucket:', error);
		}
	}

	return setInterval(() => void sweep(), ctx.env.STAGING_SWEEP_INTERVAL_SECONDS * 1000);
}

/**
 * @description Cancels every open submission of a banned user, which releases the addon ids their
 * listings claimed, records a `submission.cancelled` event for each, and deletes their staged objects.
 * @param ctx The database and storage.
 * @param userId The banned user.
 * @returns How many submissions were cancelled.
 */
export async function purgeUserSubmissions(ctx: StagingContext, userId: string): Promise<number> {
	const at = new Date();
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
