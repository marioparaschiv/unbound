import { sql, type SQL } from 'drizzle-orm';

import { addon, addonVersion } from '~/db/schema';
import { ApiError } from '~/lib/api/errors';

// The `addon` columns the rules read; a relational `RAW` filter passes its aliased table.
type AddonColumns = Pick<typeof addon, 'id' | 'delistedAt'>;

type VersionState = Pick<typeof addonVersion.$inferSelect, 'withdrawnBy' | 'filesPendingSince'>;

/** Relational filter for the live versions, the ones an addon can serve: files written and no rollback withdrew them. */
export const LIVE_VERSIONS = {
	withdrawnBy: { isNull: true },
	filesPendingSince: { isNull: true },
} as const;

/** Relational `versions` options that load the version an addon serves: its newest live one. Add `columns` or `with`. */
export const SERVED_VERSION = {
	where: LIVE_VERSIONS,
	orderBy: { versionKey: 'desc' },
	limit: 1,
} as const;

/** Relational filter for the listed addons: not delisted and serving a version. */
export const LISTED_ADDONS = {
	delistedAt: { isNull: true },
	versions: LIVE_VERSIONS,
} as const;

/**
 * @description Tells whether a loaded version row is live, the in-memory form of {@link LIVE_VERSIONS}.
 * @param version The row's withdrawal and pending-files columns.
 * @returns Whether the addon can serve it.
 */
export function isLive(version: VersionState): boolean {
	return version.withdrawnBy === null && version.filesPendingSince === null;
}

/**
 * @description The SQL form of {@link LIVE_VERSIONS}, over the `addon_version` table.
 * @returns The condition.
 */
export function isLiveVersion(): SQL {
	return sql`(${addonVersion.withdrawnBy} is null and ${addonVersion.filesPendingSince} is null)`;
}

/**
 * @description The SQL form of {@link LISTED_ADDONS}.
 * @param table The `addon` table or the alias a relational filter passes.
 * @returns The condition.
 */
export function isListedAddon(table: AddonColumns = addon): SQL {
	return sql`(${table.delistedAt} is null and exists (select 1 from ${addonVersion} where ${addonVersion.addonId} = ${table.id} and ${isLiveVersion()}))`;
}

/**
 * @description The SQL form of {@link SERVED_VERSION}: a subquery reading one value of the version an
 * addon serves, `null` when it serves none.
 * @param table The `addon` table or the alias a relational filter passes.
 * @param value The `addon_version` column or expression to read.
 * @returns The scalar subquery.
 */
export function servedVersionValue(table: Pick<AddonColumns, 'id'>, value: SQL): SQL {
	return sql`(select ${value} from ${addonVersion} where ${addonVersion.addonId} = ${table.id} and ${isLiveVersion()} order by ${addonVersion.versionKey} desc limit 1)`;
}

/**
 * @description Refuses a lookup that found no addon with `not_found`.
 * @template T The loaded addon row.
 * @param row The addon, or `undefined` when no addon has the id.
 * @param id The addon id looked up.
 * @returns The addon.
 */
export function requireAddon<T>(row: T | undefined, id: string): T {
	if (row === undefined) {
		throw new ApiError('not_found', `Addon ${id} does not exist.`);
	}

	return row;
}

export default {
	LIVE_VERSIONS,
	SERVED_VERSION,
	LISTED_ADDONS,
	isLive,
	isLiveVersion,
	isListedAddon,
	servedVersionValue,
	requireAddon,
};
