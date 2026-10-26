import { pgTable, text, bigint, index, primaryKey } from 'drizzle-orm/pg-core';

import { timestampMs } from './columns';

export type BotFeed = 'addons' | 'members' | 'releases';

/**
 * The latest change of each key of each bot feed. Triggers in the baseline migration write it on every
 * change of a feed's inputs, giving the key a `seq` past every other key, drawn in commit order.
 */
export const botFeedChange = pgTable(
	'bot_feed_change',
	{
		feed: text('feed').$type<BotFeed>().notNull(),
		/** An addon id, a user id, or a release's `platform:version`. */
		key: text('key').notNull(),
		seq: bigint('seq', { mode: 'number' }).notNull(),
		changedAt: timestampMs('changed_at').notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.feed, table.key] }),
		index('bot_feed_change_feed_seq_idx').on(table.feed, table.seq, table.key),
	],
);
