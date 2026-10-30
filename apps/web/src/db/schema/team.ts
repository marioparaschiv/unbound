import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';

import type { TeamGroup } from '~/db/team-groups';

import { timestampMs } from './columns';

/** A Discord user id, as an addon manifest credits its authors. */
export type DiscordId = PublishedManifest['authors'][number]['id'];

// The order lives outside the schema barrel, which hands every value export to drizzle.
export type { TeamGroup } from '~/db/team-groups';

/** The groups a Discord role can grant; anyone else a listed addon credits is `addon-developer` too. */
export type DiscordTeamGroup = TeamGroup;

/** The site roles a Discord role can grant, and the only ones the sync ever takes away. */
export type StaffRole = 'admin' | 'moderator';

/** The Unbound Discord members holding a team role, as the last complete team sync saw them. */
export const teamMember = pgTable('team_member', {
	discordId: text('discord_id').$type<DiscordId>().primaryKey(),
	group: text('group').$type<DiscordTeamGroup>().notNull(),
	/** The site role their Discord roles grant; `null` when they grant none. */
	staffRole: text('staff_role').$type<StaffRole>(),
	/** Manual order within a group, lower first; the sync never writes it and `null` sorts last. */
	position: integer('position'),
	syncedAt: timestampMs('synced_at').notNull(),
});
