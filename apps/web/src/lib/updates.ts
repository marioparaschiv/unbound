import type {
	UpdatesRequest,
	UpdatesResponse,
	VersionChangelog,
} from '@unbound-app/contracts/updates';
import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, max, or } from 'drizzle-orm';
import { MAX_UPDATE_CHANGELOGS } from '@unbound-app/contracts/updates';

import { getArtifactKeys, getCdnUrl } from '~/lib/artifacts';
import { addon, addonVersion } from '~/db/schema';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';

/**
 * @description Builds the single statement that finds, per listed addon, its newest live version the
 * client can run. SQLite fills the other selected columns from the row holding the `max()`.
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
				isNull(addonVersion.withdrawnBy),
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

/** An installed version, as an addon id and version key. */
type InstalledVersion = {
	addonId: string;
	key: string;
};

/**
 * @description Reads the changelog of every live version each update skips over, in one statement.
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
			and(
				isNull(addonVersion.withdrawnBy),
				or(
					...ranges.map((range) =>
						and(
							eq(addonVersion.addonId, range.addonId),
							gt(addonVersion.versionKey, range.from),
							lte(addonVersion.versionKey, range.to),
						),
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
 * @description Reads which of the given installed versions a rollback withdrew, in one statement.
 * @param ctx The application context.
 * @param installed The installed versions newer than what the client can be served.
 * @returns The addon ids whose installed version is withdrawn.
 */
async function withdrawnInstalls(
	ctx: AppContext,
	installed: InstalledVersion[],
): Promise<Set<string>> {
	const rows = await ctx.db
		.select({ addonId: addonVersion.addonId })
		.from(addonVersion)
		.where(
			and(
				isNotNull(addonVersion.withdrawnBy),
				or(
					...installed.map((entry) =>
						and(
							eq(addonVersion.addonId, entry.addonId),
							eq(addonVersion.versionKey, entry.key),
						),
					),
				),
			),
		);

	return new Set(rows.map((row) => row.addonId));
}

/**
 * @description Resolves the client's update check: for each installed addon that has a newer live
 * version compatible with the client, the newest such version, its CDN URLs, and the changelogs of
 * every version it skips over. A client on a version a rollback withdrew is offered the newest live
 * compatible version below it, with no changelogs. Unknown, delisted and up-to-date addons are left out.
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
	const newer: UpdateRange[] = [];
	const ahead: InstalledVersion[] = [];

	for (const { addonId, versionKey } of rows) {
		const from = installed.get(addonId) ?? '';

		if (!versionKey) {
			continue;
		}

		if (versionKey > from) {
			newer.push({ addonId, from, to: versionKey });
		} else if (versionKey < from) {
			ahead.push({ addonId, key: from });
		}
	}

	// Each follow-up statement runs only when needed, so an up-to-date check stays one statement.
	const [changelogs, withdrawn] = await Promise.all([
		newer.length > 0 ? changelogsFor(ctx, newer) : new Map<string, VersionChangelog[]>(),
		ahead.length > 0 ? withdrawnInstalls(ctx, ahead) : new Set<string>(),
	]);
	const newerIds = new Set(newer.map((range) => range.addonId));
	const offered = rows.filter((row) => newerIds.has(row.addonId) || withdrawn.has(row.addonId));

	const updates = offered.map((row) => {
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
