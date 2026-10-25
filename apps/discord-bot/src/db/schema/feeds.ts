import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { FeedName } from '~/lib/feed/types';

export const feedCursor = pgTable('feed_cursor', {
	feed: text('feed').$type<FeedName>().primaryKey(),
	cursor: text('cursor').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
