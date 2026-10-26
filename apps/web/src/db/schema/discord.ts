import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const discordProfile = sqliteTable(
	'discord_profile',
	{
		discordId: text('discord_id').primaryKey(),
		username: text('username'),
		globalName: text('global_name'),
		avatarHash: text('avatar_hash'),
		fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [index('discord_profile_fetchedAt_idx').on(table.fetchedAt)],
);
