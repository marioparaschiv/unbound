import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { AddonFeedItem, AddonType } from '~/lib/feed/types';

export const addon = pgTable('addon', {
	id: text('id').primaryKey(),
	type: text('type').$type<AddonType>().notNull(),
	data: jsonb('data').$type<AddonFeedItem>().notNull(),
	contentHash: text('content_hash').notNull(),
	listed: boolean('listed').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const addonMessage = pgTable('addon_message', {
	addonId: text('addon_id')
		.primaryKey()
		.references(() => addon.id, { onDelete: 'cascade' }),
	channelId: text('channel_id').notNull(),
	messageId: text('message_id').notNull(),
	postedHash: text('posted_hash').notNull(),
	postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
	editedAt: timestamp('edited_at', { withTimezone: true }),
});
