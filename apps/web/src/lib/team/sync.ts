import { createLogger } from '@unbound-app/logger';

import { deriveStanding, readTeamSyncConfig, type TeamRoleIds } from '~/lib/team/roles';
import { reconcileSiteRoles, type RoleChange } from '~/lib/team/site-roles';
import { writeTeamSnapshot, type TeamEntry } from '~/lib/team/snapshot';
import { fetchGuildMembers } from '~/lib/team/guild-members';
import type { AppContext } from '~/lib/context';

const logger = createLogger('Web', 'Team');

export type TeamSyncResult = {
	team: number;
	changes: RoleChange[];
	/** Set when no member held the Admin role, so no staff role was taken away. */
	lockoutGuard: boolean;
};

/**
 * @description Lists the Unbound guild's members, replaces the team snapshot with those holding a
 * team role and brings site staff roles in line with it. A failed listing writes nothing, and a
 * listing with no Admin demotes no one.
 * @param ctx The application context.
 * @param ids The team role ids.
 * @param signal Cancels the member listing.
 * @returns The team size, the role changes made and whether the lockout guard held demotions back.
 */
export async function syncTeam(
	ctx: AppContext,
	ids: TeamRoleIds,
	signal?: AbortSignal,
): Promise<TeamSyncResult> {
	const members = await fetchGuildMembers(ctx.env, signal);
	const team = members.flatMap((member): TeamEntry[] => {
		const standing = deriveStanding(member.roleIds, ids);

		return standing ? [{ member, standing }] : [];
	});
	const lockoutGuard = !team.some(({ standing }) => standing.staffRole === 'admin');

	if (lockoutGuard) {
		logger.error(
			`No member of guild ${ctx.env.DISCORD_GUILD_ID} holds the Admin role ${ids.admin}; skipping demotions.`,
		);
	}

	await writeTeamSnapshot(ctx, team);

	const changes = await reconcileSiteRoles(ctx.db, { demote: !lockoutGuard, at: ctx.now() });

	return { team: team.length, changes, lockoutGuard };
}

/**
 * @description Runs {@link syncTeam} at boot and every `TEAM_SYNC_INTERVAL_SECONDS` when every team
 * role id is set. A failed run is logged and retried on the next tick; a slow run is never overlapped.
 * @param ctx The application context.
 * @returns The interval timer, or `undefined` when a team role id is unset.
 */
export function startTeamSync(ctx: AppContext): Timer | undefined {
	const config = readTeamSyncConfig(ctx.env);

	if (config.kind === 'off') {
		logger.warn(`Team sync is off until ${config.missing.join(', ')} is set.`);

		return;
	}

	let running = false;

	async function sync(roleIds: TeamRoleIds) {
		if (running) return;

		running = true;

		try {
			const { team, changes } = await syncTeam(ctx, roleIds);

			for (const change of changes) {
				logger.info(
					`Set the role of user ${change.userId}: ${change.from} → ${change.to}.`,
				);
			}

			logger.debug(`Synced ${team} team members.`);
		} catch (error) {
			logger.error('Failed to sync the team:', error);
		} finally {
			running = false;
		}
	}

	void sync(config.ids);

	return setInterval(() => void sync(config.ids), ctx.env.TEAM_SYNC_INTERVAL_SECONDS * 1000);
}

export default { syncTeam, startTeamSync };
