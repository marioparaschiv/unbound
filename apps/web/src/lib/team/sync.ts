import { createLogger } from '@unbound-app/logger';

import { deriveStanding, readTeamSyncConfig, type TeamRoleIds } from '~/lib/team/roles';
import { reconcileSiteRoles, type RoleChange } from '~/lib/team/site-roles';
import { writeTeamSnapshot, type TeamEntry } from '~/lib/team/snapshot';
import { fetchGuildMembers } from '~/lib/team/guild-members';
import { readCandidateIds } from '~/lib/team/candidates';
import { startPeriodicJob, type Job } from '~/lib/jobs';
import type { AppContext } from '~/lib/context';

const logger = createLogger('Web', 'Team');

export type TeamSyncResult = {
	team: number;
	changes: RoleChange[];
};

/**
 * @description Looks up every candidate in the Unbound guild, replaces the team snapshot with those
 * holding a team role and grants the staff site roles it names. A failed lookup writes nothing.
 * @param ctx The application context.
 * @param ids The team role ids.
 * @param signal Cancels the lookups.
 * @returns The team size and the role grants made.
 */
export async function syncTeam(
	ctx: AppContext,
	ids: TeamRoleIds,
	signal?: AbortSignal,
): Promise<TeamSyncResult> {
	const members = await fetchGuildMembers(ctx.env, await readCandidateIds(ctx), signal);
	const team = members.flatMap((member): TeamEntry[] => {
		const standing = deriveStanding(member.roleIds, ids);

		return standing ? [{ member, standing }] : [];
	});

	await writeTeamSnapshot(ctx, team);

	const changes = await reconcileSiteRoles(ctx.db, ctx.now());

	return { team: team.length, changes };
}

/**
 * @description Runs {@link syncTeam} at boot and every `TEAM_SYNC_INTERVAL_SECONDS` as a periodic
 * job when every team role id is set.
 * @param ctx The application context.
 * @returns The started job, or `undefined` when a team role id is unset.
 */
export function startTeamSync(ctx: AppContext): Job | undefined {
	const config = readTeamSyncConfig(ctx.env);

	if (config.kind === 'off') {
		logger.warn(`Team sync is off until ${config.missing.join(', ')} is set.`);

		return;
	}

	return startPeriodicJob(ctx.jobs, 'team', ctx.env.TEAM_SYNC_INTERVAL_SECONDS, async () => {
		const { team, changes } = await syncTeam(ctx, config.ids);

		for (const change of changes) {
			logger.info(`Set the role of user ${change.userId}: ${change.from} → ${change.to}.`);
		}

		logger.debug(`Synced ${team} team members.`);
	});
}

export default { syncTeam, startTeamSync };
