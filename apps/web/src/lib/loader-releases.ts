import type {
	LoaderPlatform,
	LoaderRelease,
	LoaderUpdateQuery,
	LoaderUpdateResponse,
	PublishLoaderReleaseRequest,
} from '@unbound-app/contracts/loader';
import { MAX_UPDATE_CHANGELOGS } from '@unbound-app/contracts/updates';
import { and, desc, eq, gt, like } from 'drizzle-orm';

import { RELEASE_KEY_SUFFIX, isReleaseKey, toVersionKey } from '~/lib/version-key';
import { requirePermission } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { loaderRelease } from '~/db/schema';
import { ApiError } from '~/lib/api/errors';

type LoaderReleaseRow = typeof loaderRelease.$inferSelect;

/**
 * @description Serializes a loader release row for the API.
 * @param row The release row.
 * @returns The release.
 */
export function toLoaderRelease(row: LoaderReleaseRow): LoaderRelease {
	return {
		platform: row.platform,
		version: row.version,
		url: row.url,
		changelog: row.changelog,
		publishedAt: row.publishedAt.toISOString(),
	};
}

/**
 * @description Publishes a native loader release, or replaces the `url` and `changelog` of one already
 * published under the same platform and version, keeping its original publish time. CI may retry freely.
 * @param ctx The application context.
 * @param caller The caller; needs `loader: ['publish']`.
 * @param request The release to publish.
 * @returns The stored release.
 */
export async function publishLoaderRelease(
	ctx: AppContext,
	caller: Caller,
	request: PublishLoaderReleaseRequest,
): Promise<LoaderRelease> {
	requirePermission(caller, { loader: ['publish'] });

	const changelog = request.changelog ?? null;

	const [row] = await ctx.db
		.insert(loaderRelease)
		.values({
			platform: request.platform,
			version: request.version,
			versionKey: toVersionKey(request.version),
			url: request.url,
			changelog,
			publishedBy: caller.user.id,
			publishedAt: ctx.now(),
		})
		.onConflictDoUpdate({
			target: [loaderRelease.platform, loaderRelease.version],
			set: { url: request.url, changelog },
		})
		.returning();

	if (!row) {
		throw new Error(`Loader release ${request.platform} ${request.version} was not stored.`);
	}

	return toLoaderRelease(row);
}

/**
 * @description Withdraws a native loader release so no client is offered it again.
 * @param ctx The application context.
 * @param caller The caller; needs `loader: ['publish']`.
 * @param platform The release's platform.
 * @param version The release's version.
 * @returns The withdrawn release; fails with `not_found` when none was published.
 */
export async function withdrawLoaderRelease(
	ctx: AppContext,
	caller: Caller,
	platform: LoaderPlatform,
	version: string,
): Promise<LoaderRelease> {
	requirePermission(caller, { loader: ['publish'] });

	const [row] = await ctx.db
		.delete(loaderRelease)
		.where(and(eq(loaderRelease.platform, platform), eq(loaderRelease.version, version)))
		.returning();

	if (!row) {
		throw new ApiError('not_found', `No ${platform} loader release ${version} exists.`);
	}

	return toLoaderRelease(row);
}

/**
 * @description Builds the single statement behind a loader update check: the platform's releases newer
 * than the installed version, newest first. Prereleases are offered only to a prerelease install.
 * @param ctx The application context.
 * @param query The installed loader's platform and version.
 * @returns The query, unexecuted.
 */
export function newerLoaderReleases(ctx: AppContext, query: LoaderUpdateQuery) {
	const installed = toVersionKey(query.version);
	const onPrerelease = !isReleaseKey(installed);

	return ctx.db
		.select()
		.from(loaderRelease)
		.where(
			and(
				eq(loaderRelease.platform, query.platform),
				gt(loaderRelease.versionKey, installed),
				onPrerelease ? undefined : like(loaderRelease.versionKey, `%${RELEASE_KEY_SUFFIX}`),
			),
		)
		.orderBy(desc(loaderRelease.versionKey))
		.limit(MAX_UPDATE_CHANGELOGS);
}

/**
 * @description Resolves a loader update check: the newest release the installed loader may move to,
 * with the changelog of every version it skips over.
 * @param ctx The application context.
 * @param query The installed loader's platform and version.
 * @returns The update, or `null` when the installed loader is current.
 */
export async function findLoaderUpdate(
	ctx: AppContext,
	query: LoaderUpdateQuery,
): Promise<LoaderUpdateResponse> {
	const rows = await newerLoaderReleases(ctx, query);
	const [newest] = rows;

	if (!newest) {
		return { update: null };
	}

	return {
		update: {
			...toLoaderRelease(newest),
			changelogs: rows.map((row) => ({
				version: row.version,
				changelog: row.changelog,
				publishedAt: row.publishedAt.toISOString(),
			})),
		},
	};
}

export default {
	toLoaderRelease,
	publishLoaderRelease,
	withdrawLoaderRelease,
	newerLoaderReleases,
	findLoaderUpdate,
};
