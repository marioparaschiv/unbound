import { pgTable, text } from 'drizzle-orm/pg-core';

import type { DiscordTeamGroup, StaffRole } from '~/lib/team/roles';
import type { DiscordId } from '~/lib/authors/discord-users';

import { timestampMs } from './columns';

/** The Unbound Discord members holding a team role, as the last complete team sync saw them. */
export const teamMember = pgTable('team_member', {
	discordId: text('discord_id').$type<DiscordId>().primaryKey(),
	group: text('group').$type<DiscordTeamGroup>().notNull(),
	/** The site role their Discord roles grant; `null` when they grant none. */
	staffRole: text('staff_role').$type<StaffRole>(),
	syncedAt: timestampMs('synced_at').notNull(),
});
