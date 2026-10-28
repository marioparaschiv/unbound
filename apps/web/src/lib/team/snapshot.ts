import { notInArray, sql } from 'drizzle-orm';

import type { DiscordTeamGroup, TeamStanding } from '~/lib/team/roles';
import type { DiscordId } from '~/lib/authors/discord-users';
import type { GuildMember } from '~/lib/team/guild-members';
import { discordProfile, teamMember } from '~/db/schema';
import type { AppContext } from '~/lib/context';

/** A guild member holding a team role, with what their roles make them. */
export type TeamEntry = {
	member: GuildMember;
	standing: TeamStanding;
};

/**
 * @description Reads the team group of everyone in the last team snapshot.
 * @param ctx The application context.
 * @returns Each member's group by Discord id.
 */
export async function readTeamGroups(ctx: AppContext): Promise<Map<DiscordId, DiscordTeamGroup>> {
	const rows = await ctx.db
		.select({ discordId: teamMember.discordId, group: teamMember.group })
		.from(teamMember);

	return new Map(rows.map((row) => [row.discordId, row.group]));
}

/**
 * @description Replaces the team snapshot with a complete member listing's team, and caches each
 * member's Discord profile so they resolve a name and avatar without a site account.
 * @param ctx The application context.
 * @param team Every guild member holding a team role.
 * @returns Resolves once the snapshot and profiles are written together.
 */
export async function writeTeamSnapshot(ctx: AppContext, team: TeamEntry[]): Promise<void> {
	const now = ctx.now();
	const ids = team.map(({ member }) => member.user.id);

	await ctx.db.transaction(async (tx) => {
		await tx
			.delete(teamMember)
			.where(ids.length ? notInArray(teamMember.discordId, ids) : undefined);

		if (team.length === 0) return;

		await tx
			.insert(teamMember)
			.values(
				team.map(({ member, standing }) => ({
					discordId: member.user.id,
					group: standing.group,
					staffRole: standing.staffRole,
					syncedAt: now,
				})),
			)
			.onConflictDoUpdate({
				target: teamMember.discordId,
				set: {
					group: sql`excluded."group"`,
					staffRole: sql`excluded.staff_role`,
					syncedAt: sql`excluded.synced_at`,
				},
			});

		await tx
			.insert(discordProfile)
			.values(
				team.map(({ member: { user } }) => ({
					discordId: user.id,
					username: user.username,
					globalName: user.globalName,
					avatarHash: user.avatarHash,
					fetchedAt: now,
				})),
			)
			.onConflictDoUpdate({
				target: discordProfile.discordId,
				set: {
					username: sql`excluded.username`,
					globalName: sql`excluded.global_name`,
					avatarHash: sql`excluded.avatar_hash`,
					fetchedAt: sql`excluded.fetched_at`,
				},
			});
	});
}

export default { readTeamGroups, writeTeamSnapshot };
