import type {
	DevtoolsRelease,
	DevtoolsUpdateQuery,
	DevtoolsUpdateResponse,
	PublishDevtoolsReleaseRequest,
} from '@unbound-app/contracts/devtools';
import { MAX_UPDATE_CHANGELOGS } from '@unbound-app/contracts/updates';
import { and, desc, gt, like, sql } from 'drizzle-orm';

import { RELEASE_KEY_SUFFIX, isReleaseKey, toVersionKey } from '~/lib/version-key';
import { requirePermission } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { devtoolsRelease } from '~/db/schema';

type DevtoolsReleaseRow = typeof devtoolsRelease.$inferSelect;

/**
 * @description Serializes a DevTools release row for the API.
 * @param row The release row.
 * @returns The release.
 */
export function toDevtoolsRelease(row: DevtoolsReleaseRow): DevtoolsRelease {
	return {
		version: row.version,
		assets: row.assets,
		changelog: row.changelog,
		publishedAt: row.publishedAt.toISOString(),
	};
}

/**
 * @description Publishes a DevTools release, or replaces the `assets` and `changelog` of one already published
 * under the same version, keeping its original publish time. CI may retry freely.
 * @param ctx The application context.
 * @param caller The caller; needs `devtools: ['publish']`.
 * @param request The release to publish.
 * @returns The stored release.
 */
export async function publishDevtoolsRelease(
	ctx: AppContext,
	caller: Caller,
	request: PublishDevtoolsReleaseRequest,
): Promise<DevtoolsRelease> {
	requirePermission(caller, { devtools: ['publish'] });

	const changelog = request.changelog ?? null;

	const [row] = await ctx.db
		.insert(devtoolsRelease)
		.values({
			version: request.version,
			versionKey: toVersionKey(request.version),
			assets: request.assets,
			changelog,
			publishedBy: caller.user.id,
			publishedAt: ctx.now(),
		})
		.onConflictDoUpdate({
			target: devtoolsRelease.version,
			set: { assets: request.assets, changelog },
		})
		.returning();

	if (!row) {
		throw new Error(`DevTools release ${request.version} was not stored.`);
	}

	return toDevtoolsRelease(row);
}

/**
 * @description Resolves a DevTools update check: the newest release built for the installed app's target,
 * with the changelog of every version it skips over. Prereleases are offered only to a prerelease install.
 * @param ctx The application context.
 * @param query The installed app's target and version.
 * @returns The update, or `null` when the installed app is current.
 */
export async function findDevtoolsUpdate(
	ctx: AppContext,
	query: DevtoolsUpdateQuery,
): Promise<DevtoolsUpdateResponse> {
	const installed = toVersionKey(query.version);
	const onPrerelease = !isReleaseKey(installed);
	const rows = await ctx.db
		.select()
		.from(devtoolsRelease)
		.where(
			and(
				gt(devtoolsRelease.versionKey, installed),
				onPrerelease
					? undefined
					: like(devtoolsRelease.versionKey, `%${RELEASE_KEY_SUFFIX}`),
				sql`${devtoolsRelease.assets} @> jsonb_build_array(jsonb_build_object('target', ${query.target}::text))`,
			),
		)
		.orderBy(desc(devtoolsRelease.versionKey))
		.limit(MAX_UPDATE_CHANGELOGS);
	const [newest] = rows;
	const asset = newest?.assets.find((entry) => entry.target === query.target);

	if (!newest || !asset) {
		return { update: null };
	}

	return {
		update: {
			version: newest.version,
			changelog: newest.changelog,
			publishedAt: newest.publishedAt.toISOString(),
			url: asset.url,
			sha256: asset.sha256,
			changelogs: rows.map((row) => ({
				version: row.version,
				changelog: row.changelog,
				publishedAt: row.publishedAt.toISOString(),
			})),
		},
	};
}

export default { toDevtoolsRelease, publishDevtoolsRelease, findDevtoolsUpdate };
