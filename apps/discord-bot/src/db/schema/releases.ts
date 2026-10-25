import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import type { LoaderPlatform } from '~/lib/feed/types';

export const loaderRelease = pgTable(
	'loader_release',
	{
		platform: text('platform').$type<LoaderPlatform>().notNull(),
		version: text('version').notNull(),
		url: text('url').notNull(),
		changelog: text('changelog'),
		publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
		channelId: text('channel_id'),
		messageId: text('message_id'),
	},
	(table) => [primaryKey({ columns: [table.platform, table.version] })],
);
