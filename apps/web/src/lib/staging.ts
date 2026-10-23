import { and, eq, inArray, lte } from 'drizzle-orm';
import { createLogger } from '@unbound-app/logger';

import { OPEN_SUBMISSION_STATUSES } from '~/lib/submissions';
import type { AppContext } from '~/lib/context';
import { submission } from '~/db/schema';

const logger = createLogger('Web', 'Staging');

const LIST_PAGE_SIZE = 1000;

export type StagingContext = Pick<AppContext, 'db' | 'storage'>;

export type SweepResult = {
	/** Reservations closed because their upload lapsed without being finalized. */
	expired: number;
	/** Staged objects deleted because no open submission owns them. */
	orphans: number;
};

async function deleteStaged(ctx: StagingContext, keys: string[]) {
	await Promise.all(keys.map((key) => ctx.storage.staging.delete(key)));
}

async function expireReservations(ctx: AppContext): Promise<number> {
	const expired = ctx.db
		.update(submission)
		.set({ status: 'expired' })
		.where(
			and(
				eq(submission.status, 'awaiting_upload'),
				lte(submission.uploadExpiresAt, ctx.now()),
			),
		)
		.returning({ key: submission.stagingKey })
		.all();

	await deleteStaged(
		ctx,
		expired.map((row) => row.key),
	);

	return expired.length;
}

async function deleteOrphans(ctx: AppContext): Promise<number> {
	let deleted = 0;
	let startAfter: string | undefined;
	let truncated = true;

	while (truncated) {
		const page = await ctx.storage.staging.list({ startAfter, maxKeys: LIST_PAGE_SIZE });
		const keys = (page.contents ?? []).map((object) => object.key);

		if (keys.length === 0) {
			break;
		}

		const owned = ctx.db
			.select({ key: submission.stagingKey })
			.from(submission)
			.where(
				and(
					inArray(submission.stagingKey, keys),
					inArray(submission.status, OPEN_SUBMISSION_STATUSES),
				),
			)
			.all();

		const kept = new Set(owned.map((row) => row.key));
		const orphans = keys.filter((key) => !kept.has(key));

		await deleteStaged(ctx, orphans);

		deleted += orphans.length;
		startAfter = keys.at(-1);
		truncated = page.isTruncated ?? false;
	}

	return deleted;
}

/**
 * @description Cleans the staging bucket: closes `awaiting_upload` reservations whose upload URL has
 * expired as `expired` and deletes their objects, then deletes every staged object no open submission
 * owns. An upload that landed just before its URL expired can be finalized only until the next sweep.
 * @param ctx The application context; its clock decides which reservations have lapsed.
 * @returns How many reservations were expired and orphaned objects deleted.
 */
export async function sweepStaging(ctx: AppContext): Promise<SweepResult> {
	const expired = await expireReservations(ctx);
	const orphans = await deleteOrphans(ctx);

	return { expired, orphans };
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
			const { expired, orphans } = await sweepStaging(ctx);

			if (expired + orphans === 0) return;

			logger.info(`Expired ${expired} reservations and deleted ${orphans} orphaned objects.`);
		} catch (error) {
			logger.error('Failed to sweep the staging bucket:', error);
		}
	}

	return setInterval(() => void sweep(), ctx.env.STAGING_SWEEP_INTERVAL_SECONDS * 1000);
}

/**
 * @description Cancels every open submission of a banned user, which releases the addon ids their
 * listings claimed, and deletes their staged objects.
 * @param ctx The database and storage.
 * @param userId The banned user.
 * @returns How many submissions were cancelled.
 */
export async function purgeUserSubmissions(ctx: StagingContext, userId: string): Promise<number> {
	const cancelled = ctx.db
		.update(submission)
		.set({ status: 'cancelled' })
		.where(
			and(
				eq(submission.authorId, userId),
				inArray(submission.status, OPEN_SUBMISSION_STATUSES),
			),
		)
		.returning({ key: submission.stagingKey })
		.all();

	await deleteStaged(
		ctx,
		cancelled.map((row) => row.key),
	);

	return cancelled.length;
}

export default { sweepStaging, startStagingSweeper, purgeUserSubmissions };
