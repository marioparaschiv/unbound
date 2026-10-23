import type {
	UpdatesRequest,
	UpdatesResponse,
	VersionChangelog,
} from '@unbound-app/contracts/updates';
import { and, desc, eq, gt, inArray, isNull, lte, max, or } from 'drizzle-orm';
import { MAX_UPDATE_CHANGELOGS } from '@unbound-app/contracts/updates';

import { getArtifactKeys, getCdnUrl } from '~/lib/artifacts';
import { addon, addonVersion } from '~/db/schema';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';

/**
 * @description Builds the single statement that finds, per listed addon, its newest approved version
 * the client can run. SQLite fills the other selected columns from the row holding the `max()`.
 * @param ctx The application context.
 * @param request The client version and installed addons.
 * @returns The query, unexecuted.
 */
export function newestCompatibleVersions(ctx: AppContext, request: UpdatesRequest) {
	return ctx.db
		.select({
			addonId: addonVersion.addonId,
			version: addonVersion.version,
			versionKey: max(addonVersion.versionKey),
			manifest: addonVersion.manifest,
			changelog: addonVersion.changelog,
			sha256: addonVersion.sha256,
		})
		.from(addonVersion)
		.innerJoin(addon, eq(addon.id, addonVersion.addonId))
		.where(
			and(
				inArray(
					addonVersion.addonId,
					request.addons.map((installed) => installed.id),
				),
				lte(addonVersion.minClientKey, toVersionKey(request.clientVersion)),
				isNull(addon.delistedAt),
			),
		)
		.groupBy(addonVersion.addonId);
}

/** The version range one update spans: newer than `from`, up to and including `to`, as version keys. */
type UpdateRange = {
	addonId: string;
	from: string;
	to: string;
};

/**
 * @description Reads the changelog of every version each update skips over, in one statement.
 * @param ctx The application context.
 * @param ranges The version range of each update.
 * @returns The changelogs keyed by addon id, newest first, at most `MAX_UPDATE_CHANGELOGS` each.
 */
async function changelogsFor(
	ctx: AppContext,
	ranges: UpdateRange[],
): Promise<Map<string, VersionChangelog[]>> {
	const rows = await ctx.db
		.select({
			addonId: addonVersion.addonId,
			version: addonVersion.version,
			changelog: addonVersion.changelog,
			publishedAt: addonVersion.publishedAt,
		})
		.from(addonVersion)
		.where(
			or(
				...ranges.map((range) =>
					and(
						eq(addonVersion.addonId, range.addonId),
						gt(addonVersion.versionKey, range.from),
						lte(addonVersion.versionKey, range.to),
					),
				),
			),
		)
		.orderBy(addonVersion.addonId, desc(addonVersion.versionKey));

	const changelogs = new Map<string, VersionChangelog[]>();

	for (const row of rows) {
		const list = changelogs.get(row.addonId) ?? [];

		if (list.length < MAX_UPDATE_CHANGELOGS) {
			list.push({
				version: row.version,
				changelog: row.changelog,
				publishedAt: row.publishedAt.toISOString(),
			});
		}

		changelogs.set(row.addonId, list);
	}

	return changelogs;
}

/**
 * @description Resolves the client's update check: for each installed addon that has a newer approved
 * version compatible with the client, the newest such version, its CDN URLs, and the changelogs of
 * every version it skips over. Unknown, delisted and up-to-date addons are left out.
 * @param ctx The application context.
 * @param request The client version and installed addons.
 * @returns The available updates.
 */
export async function findUpdates(
	ctx: AppContext,
	request: UpdatesRequest,
): Promise<UpdatesResponse> {
	if (request.addons.length === 0) {
		return { updates: [] };
	}

	const installed = new Map(
		request.addons.map((entry) => [entry.id, toVersionKey(entry.version)]),
	);
	const rows = await newestCompatibleVersions(ctx, request);
	const newer = rows.flatMap((row) => {
		const from = installed.get(row.addonId) ?? '';

		return row.versionKey && row.versionKey > from
			? [{ ...row, from, to: row.versionKey }]
			: [];
	});

	if (newer.length === 0) {
		return { updates: [] };
	}

	const changelogs = await changelogsFor(ctx, newer);

	const updates = newer.map((row) => {
		const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);

		return {
			id: row.addonId,
			version: row.version,
			manifestUrl: getCdnUrl(ctx.env, keys.manifest),
			bundleUrl: getCdnUrl(ctx.env, keys.bundle),
			sha256: row.sha256,
			changelog: row.changelog,
			changelogs: changelogs.get(row.addonId) ?? [],
		};
	});

	return { updates };
}

export default { newestCompatibleVersions, findUpdates };
