import type { DiscordTeamGroup, StaffRole, TeamGroup } from '~/db/schema';
import { TEAM_GROUPS } from '~/db/team-groups';
import type { Role } from '~/lib/auth/access';
import type { Env } from '~/lib/env';

export type DiscordTeamRole =
	| 'admin'
	| 'staff'
	| 'development-team'
	| 'management'
	| 'contributor'
	| 'addon-developer';

export type TeamRoleIds = Record<DiscordTeamRole, string>;

export type TeamSyncConfig = { kind: 'on'; ids: TeamRoleIds } | { kind: 'off'; missing: string[] };

/** What a guild member's Discord roles make them on the site. */
export type TeamStanding = {
	group: DiscordTeamGroup;
	staffRole: StaffRole | null;
};

type Grant<T> = [role: DiscordTeamRole, value: T];

// Highest first: a member holding several roles gets the first match.
const GROUP_GRANTS: Grant<DiscordTeamGroup>[] = [
	['development-team', 'development-team'],
	['management', 'staff'],
	['admin', 'staff'],
	['staff', 'staff'],
	['contributor', 'contributor'],
	['addon-developer', 'addon-developer'],
];

// Development Team and Management rank above Admin in the guild, so they grant admin too.
const STAFF_ROLE_GRANTS: Grant<StaffRole>[] = [
	['development-team', 'admin'],
	['management', 'admin'],
	['admin', 'admin'],
	['staff', 'moderator'],
];

export const STAFF_ROLES: StaffRole[] = ['admin', 'moderator'] satisfies Role[];

/**
 * @description Reads the team role ids from the environment.
 * @param env The validated environment.
 * @returns The ids, or the names of the unset variables when any is missing.
 */
export function readTeamSyncConfig(env: Env): TeamSyncConfig {
	const ids = {
		admin: env.DISCORD_ADMIN_ROLE_ID,
		staff: env.DISCORD_STAFF_ROLE_ID,
		'development-team': env.DISCORD_DEVELOPMENT_TEAM_ROLE_ID,
		management: env.DISCORD_MANAGEMENT_ROLE_ID,
		contributor: env.DISCORD_CONTRIBUTOR_ROLE_ID,
	};
	const { admin, staff, management, contributor } = ids;
	const development = ids['development-team'];

	if (admin && staff && development && management) {
		return {
			kind: 'on',
			ids: {
				admin,
				staff,
				'development-team': development,
				management,
				contributor,
				'addon-developer': env.DISCORD_ADDON_DEVELOPER_ROLE_ID,
			},
		};
	}

	const missing = [
		admin ? null : 'DISCORD_ADMIN_ROLE_ID',
		staff ? null : 'DISCORD_STAFF_ROLE_ID',
		development ? null : 'DISCORD_DEVELOPMENT_TEAM_ROLE_ID',
		management ? null : 'DISCORD_MANAGEMENT_ROLE_ID',
	].filter((name) => name !== null);

	return { kind: 'off', missing };
}

function firstGrant<T>(grants: Grant<T>[], held: Set<string>, ids: TeamRoleIds): T | null {
	return grants.find(([role]) => held.has(ids[role]))?.[1] ?? null;
}

/**
 * @description Derives a guild member's team group and staff site role from their Discord roles.
 * @param roleIds The Discord role ids the member holds.
 * @param ids The team role ids.
 * @returns The standing, or `undefined` when they hold no team role.
 */
export function deriveStanding(roleIds: string[], ids: TeamRoleIds): TeamStanding | undefined {
	const held = new Set(roleIds);
	const group = firstGrant(GROUP_GRANTS, held, ids);

	if (!group) return;

	return { group, staffRole: firstGrant(STAFF_ROLE_GRANTS, held, ids) };
}

/**
 * @description Orders two groups by their place on the Team page.
 * @param a The first group.
 * @param b The second group.
 * @returns Negative when `a` comes first.
 */
export function compareGroups(a: TeamGroup, b: TeamGroup): number {
	return TEAM_GROUPS.indexOf(a) - TEAM_GROUPS.indexOf(b);
}

export default {
	STAFF_ROLES,
	readTeamSyncConfig,
	deriveStanding,
	compareGroups,
};
