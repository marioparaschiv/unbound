import { primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { botSchema } from './bot';

/** Roles the bot granted, so a later sync skips them and every grant stays auditable. */
export const roleGrant = botSchema.table(
	'role_grant',
	{
		discordId: text('discord_id').notNull(),
		role: text('role').notNull(),
		grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.discordId, table.role] })],
);
