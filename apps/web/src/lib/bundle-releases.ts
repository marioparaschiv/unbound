import type {
	BundleRelease,
	LoaderUpdateQuery,
	PublishBundleReleaseRequest,
} from '@unbound-app/contracts/loader';
import { desc, eq } from 'drizzle-orm';

import { requirePermission } from '~/lib/api/caller';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { bundleRelease } from '~/db/schema';

type BundleReleaseRow = typeof bundleRelease.$inferSelect;

/**
 * @description Serializes a bundle release row for the API.
 * @param row The release row.
 * @returns The release.
 */
export function toBundleRelease(row: BundleReleaseRow): BundleRelease {
	return {
		channel: row.channel,
		version: row.version,
		minLoaderVersion: row.minLoaderVersion,
		publishedAt: row.publishedAt.toISOString(),
	};
}

/**
 * @description Records a client bundle CI published, or replaces the `minLoaderVersion` of one already
 * recorded under the same channel and version, keeping its original publish time. CI may retry freely.
 * @param ctx The application context.
 * @param caller The caller; needs `loader: ['publish']`.
 * @param request The bundle to record.
 * @returns The stored release.
 */
export async function publishBundleRelease(
	ctx: AppContext,
	caller: Caller,
	request: PublishBundleReleaseRequest,
): Promise<BundleRelease> {
	requirePermission(caller, { loader: ['publish'] });

	const [row] = await ctx.db
		.insert(bundleRelease)
		.values({
			channel: request.channel,
			version: request.version,
			minLoaderVersion: request.minLoaderVersion,
			publishedBy: caller.user.id,
			publishedAt: ctx.now(),
		})
		.onConflictDoUpdate({
			target: [bundleRelease.channel, bundleRelease.version],
			set: { minLoaderVersion: request.minLoaderVersion },
		})
		.returning();

	if (!row) {
		throw new Error(`Bundle release ${request.channel} ${request.version} was not stored.`);
	}

	return toBundleRelease(row);
}

/**
 * @description Finds the loader version the channel's newest bundle needs when the installed loader is older.
 * @param ctx The application context.
 * @param query The installed loader's version and the client's bundle channel.
 * @returns The required loader version, or `null` without a channel, a published bundle, or when the
 * installed loader runs the newest bundle.
 */
export async function findRequiredLoader(
	ctx: AppContext,
	query: LoaderUpdateQuery,
): Promise<string | null> {
	if (!query.channel) return null;

	const [newest] = await ctx.db
		.select({ minLoaderVersion: bundleRelease.minLoaderVersion })
		.from(bundleRelease)
		.where(eq(bundleRelease.channel, query.channel))
		.orderBy(desc(bundleRelease.publishedAt))
		.limit(1);

	if (!newest || toVersionKey(newest.minLoaderVersion) <= toVersionKey(query.version)) {
		return null;
	}

	return newest.minLoaderVersion;
}

export default { toBundleRelease, publishBundleRelease, findRequiredLoader };
