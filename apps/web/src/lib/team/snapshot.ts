import { notInArray, sql } from 'drizzle-orm';

import type { DiscordTeamGroup, StaffRole, TeamStanding } from '~/lib/team/roles';
import type { DiscordId } from '~/lib/authors/discord-users';
import type { GuildMember } from '~/lib/team/guild-members';
import { discordProfile, teamMember } from '~/db/schema';
import type { AppContext } from '~/lib/context';

/** A guild member holding a team role, with what their roles make them. */
export type TeamEntry = {
	member: GuildMember;
	standing: TeamStanding;
};

/** A team member as the snapshot stores them, without their id. */
export type TeamMemberRow = {
	group: DiscordTeamGroup;
	staffRole: StaffRole | null;
	position: number | null;
};

/**
 * @description Reads everyone in the last team snapshot.
 * @param ctx The application context.
 * @returns Each member by Discord id.
 */
export async function readTeamMembers(ctx: AppContext): Promise<Map<DiscordId, TeamMemberRow>> {
	const rows = await ctx.db
		.select({
			discordId: teamMember.discordId,
			group: teamMember.group,
			staffRole: teamMember.staffRole,
			position: teamMember.position,
		})
		.from(teamMember);

	return new Map(rows.map(({ discordId, ...row }) => [discordId, row]));
}

/**
 * @description Replaces the team snapshot with the looked-up candidates' team, and caches each
 * member's Discord profile so they resolve a name and avatar without a site account.
 * @param ctx The application context.
 * @param team Every looked-up guild member holding a team role.
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

export default { readTeamMembers, writeTeamSnapshot };
