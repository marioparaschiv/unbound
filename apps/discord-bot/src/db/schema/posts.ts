import { bigint, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { LoaderPlatform } from '@unbound-app/contracts/loader';

import { botSchema } from './bot';

// No foreign key to `public.addon`: the web may delete an addon, and the next sync must still find
// this row to delete its message.
export const addonMessage = botSchema.table('addon_message', {
	addonId: text('addon_id').primaryKey(),
	channelId: text('channel_id').notNull(),
	messageId: text('message_id').notNull(),
	/** The content hash of the listing the message shows; `''` makes the next sync patch it. */
	postedHash: text('posted_hash').notNull(),
	postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
	editedAt: timestamp('edited_at', { withTimezone: true }),
});

/** One row per posted moderation event and one floor row; the newest `event_id` is the audit log's cursor. */
export const auditPost = botSchema.table('audit_post', {
	eventId: bigint('event_id', { mode: 'number' }).primaryKey(),
	channelId: text('channel_id').notNull(),
	/** `null` marks the floor: the newest event when the audit log was first enabled, never posted. */
	messageId: text('message_id'),
	postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * What became of a review notice: `sent` as a DM, `unlinked` author, `undeliverable` DM, or `floor`,
 * the newest event when notices were first enabled, never sent.
 */
export type ReviewNoticeOutcome = 'sent' | 'unlinked' | 'undeliverable' | 'floor';

/** One row per handled review decision and one floor row, never deleted; the newest `event_id` is the cursor. */
export const reviewNotice = botSchema.table('review_notice', {
	eventId: bigint('event_id', { mode: 'number' }).primaryKey(),
	outcome: text('outcome').$type<ReviewNoticeOutcome>().notNull(),
	/** Set only for `sent`. */
	messageId: text('message_id'),
	handledAt: timestamp('handled_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One row per announced loader release, never deleted, so a release is never announced twice. */
export const releasePost = botSchema.table(
	'release_post',
	{
		platform: text('platform').$type<LoaderPlatform>().notNull(),
		version: text('version').notNull(),
		channelId: text('channel_id').notNull(),
		messageId: text('message_id').notNull(),
		postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.platform, table.version] })],
);
