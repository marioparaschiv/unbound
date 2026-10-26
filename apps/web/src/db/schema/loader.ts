import { pgTable, text, index, primaryKey } from 'drizzle-orm/pg-core';
import type { LoaderPlatform } from '@unbound-app/contracts/loader';

import { timestampMs } from './columns';
import { user } from './auth';

export const loaderRelease = pgTable(
	'loader_release',
	{
		platform: text('platform').$type<LoaderPlatform>().notNull(),
		version: text('version').notNull(),
		versionKey: text('version_key').notNull(),
		url: text('url').notNull(),
		changelog: text('changelog'),
		publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' }),
		publishedAt: timestampMs('published_at').notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.platform, table.version] }),
		index('loader_release_platform_versionKey_idx').on(table.platform, table.versionKey),
	],
);
