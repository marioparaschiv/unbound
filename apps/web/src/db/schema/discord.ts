import { pgTable, text, index } from 'drizzle-orm/pg-core';

import { timestampMs } from './columns';

export const discordProfile = pgTable(
	'discord_profile',
	{
		discordId: text('discord_id').primaryKey(),
		username: text('username'),
		globalName: text('global_name'),
		avatarHash: text('avatar_hash'),
		bannerHash: text('banner_hash'),
		/** The banner they set for the Unbound guild alone; only the team sync's member lookup sees it. */
		guildBannerHash: text('guild_banner_hash'),
		fetchedAt: timestampMs('fetched_at').notNull(),
	},
	(table) => [index('discord_profile_fetchedAt_idx').on(table.fetchedAt)],
);
