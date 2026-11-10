import { sql, type SQL } from 'drizzle-orm';

import { addonVersion } from '~/db/schema';

/** Relational filter for the versions an addon can serve: files written and no rollback withdrew them. */
export const LIVE_VERSIONS = {
	withdrawnBy: { isNull: true },
	filesPendingSince: { isNull: true },
} as const;

/**
 * @description The SQL form of {@link LIVE_VERSIONS}, over the `addon_version` table.
 * @returns The condition.
 */
export function isLiveVersion(): SQL {
	return sql`(${addonVersion.withdrawnBy} is null and ${addonVersion.filesPendingSince} is null)`;
}

export default { LIVE_VERSIONS, isLiveVersion };
