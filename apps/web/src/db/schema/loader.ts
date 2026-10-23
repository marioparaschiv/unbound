import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import type { LoaderPlatform } from '@unbound-app/contracts/loader';

import { user } from './auth';

/** A published native loader build. CI publishes and withdraws them; clients are offered the newest. */
export const loaderRelease = sqliteTable(
	'loader_release',
	{
		platform: text('platform').$type<LoaderPlatform>().notNull(),
		version: text('version').notNull(),
		/** `version` encoded so string order is semver precedence; see `toVersionKey`. */
		versionKey: text('version_key').notNull(),
		url: text('url').notNull(),
		changelog: text('changelog'),
		publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' }),
		publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.platform, table.version] }),
		// A platform's newest release, read in version order without sorting.
		index('loader_release_platform_versionKey_idx').on(table.platform, table.versionKey),
	],
);
