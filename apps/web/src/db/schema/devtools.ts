import type { DevtoolsAsset } from '@unbound-app/contracts/devtools';
import { pgTable, text, index, jsonb } from 'drizzle-orm/pg-core';

import { timestampMs } from './columns';
import { user } from './auth';

/** A DevTools app release CI published, with the archive it built for each target. */
export const devtoolsRelease = pgTable(
	'devtools_release',
	{
		version: text('version').primaryKey(),
		versionKey: text('version_key').notNull(),
		assets: jsonb('assets').$type<DevtoolsAsset[]>().notNull(),
		changelog: text('changelog'),
		publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' }),
		publishedAt: timestampMs('published_at').notNull(),
	},
	(table) => [index('devtools_release_versionKey_idx').on(table.versionKey)],
);
