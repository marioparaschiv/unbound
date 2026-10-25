import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

export type BotFeed = 'addons' | 'members' | 'releases';

/**
 * The latest change of each key of each bot feed. Triggers in the `bot_feed_triggers` migration write
 * it on every change of a feed's inputs, giving the key a `seq` past every other key of its feed.
 */
export const botFeedChange = sqliteTable(
	'bot_feed_change',
	{
		feed: text('feed').$type<BotFeed>().notNull(),
		/** An addon id, a user id, or a release's `platform:version`. */
		key: text('key').notNull(),
		seq: integer('seq').notNull(),
		changedAt: integer('changed_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.feed, table.key] }),
		index('bot_feed_change_feed_seq_idx').on(table.feed, table.seq, table.key),
	],
);
