import { boolean, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const member = pgTable('member', {
	userId: text('user_id').primaryKey(),
	/** `null` is the feed's tombstone: the user unlinked Discord or was deleted. */
	discordId: text('discord_id'),
	githubId: text('github_id'),
	githubLogin: text('github_login'),
	isAddonDeveloper: boolean('is_addon_developer').notNull(),
	isSponsor: boolean('is_sponsor').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const roleGrant = pgTable(
	'role_grant',
	{
		discordId: text('discord_id').notNull(),
		role: text('role').notNull(),
		grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.discordId, table.role] })],
);
