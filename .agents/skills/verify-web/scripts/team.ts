// The seeded users and the Unbound Discord team the fake Discord serves; shared by seed.ts and fake-discord.ts.
import { snowflakeAt } from '../../../../apps/web/tests/helpers/context';

// `ci` is the account CI's API key belongs to; it publishes first-party addons.
export const ROLES = ['user', 'developer', 'moderator', 'admin', 'ci'] as const;

export type SeededRole = (typeof ROLES)[number];

export const ACCOUNT_CREATED = new Date('2020-01-01T00:00:00Z');

/** launch.sh writes these as the instance's `DISCORD_*_ROLE_ID`. */
export const TEAM_ROLE_IDS = {
	admin: '1500000000000000001',
	staff: '1500000000000000002',
	developmentTeam: '1500000000000000003',
	contributor: '1500000000000000004',
};

export type TeamMemberSeed = {
	id: string;
	username: string;
	globalName: string | null;
	roleIds: string[];
};

/**
 * @description The Discord id of the seeded user with a role, dated 2020 so the account-age gate passes.
 * @param role The seeded user's role.
 * @returns The snowflake.
 */
export function discordIdOf(role: SeededRole): string {
	return snowflakeAt(new Date(ACCOUNT_CREATED.getTime() + ROLES.indexOf(role)));
}

function member(index: number, name: string, roleIds: string[]): TeamMemberSeed {
	return {
		id: String(1_600_000_000_000_000_000n + BigInt(index)),
		username: name.toLowerCase().replaceAll(' ', '.'),
		globalName: name,
		roleIds,
	};
}

const CONTRIBUTORS = Array.from({ length: 25 }, (_, index) =>
	member(10 + index, `Contributor ${String(index + 1).padStart(2, '0')}`, [
		TEAM_ROLE_IDS.contributor,
	]),
);

/** Every guild member: the team (enough for two Team pages of 24), plus one member with no team role. */
export const GUILD_MEMBERS: TeamMemberSeed[] = [
	{
		id: discordIdOf('admin'),
		username: 'verify.admin',
		globalName: 'Verify Admin',
		roleIds: [TEAM_ROLE_IDS.admin, TEAM_ROLE_IDS.staff],
	},
	{
		id: discordIdOf('moderator'),
		username: 'verify.moderator',
		globalName: 'Verify Moderator',
		roleIds: [TEAM_ROLE_IDS.staff],
	},
	{
		id: discordIdOf('user'),
		username: 'verify.user',
		globalName: 'Verify User',
		roleIds: [],
	},
	member(1, 'Dev Lead', [TEAM_ROLE_IDS.developmentTeam, TEAM_ROLE_IDS.staff]),
	member(2, 'Dev Second', [TEAM_ROLE_IDS.developmentTeam]),
	member(3, 'Staff Only', [TEAM_ROLE_IDS.staff]),
	...CONTRIBUTORS,
];
