import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';

import { deriveStanding, readTeamSyncConfig, type TeamRoleIds } from '~/lib/team/roles';
import { discordProfile, moderationEvent, teamMember, user } from '~/db/schema';
import { syncTeam } from '~/lib/team/sync';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { serveDiscord } from './helpers/discord';

const GUILD = '950850315601711176';
const IDS: TeamRoleIds = {
	admin: '900000000000000001',
	staff: '900000000000000002',
	'development-team': '900000000000000003',
	contributor: '900000000000000004',
	management: '900000000000000005',
};
const OTHER_ROLE = '900000000000000099';

const ADMIN = '100000000000000001';
const STAFF = '100000000000000002';
const DEVELOPER = '100000000000000003';
const CONTRIBUTOR = '100000000000000004';
const FORMER_MODERATOR = '100000000000000005';
const FORMER_ADMIN = '100000000000000006';
const CI = '100000000000000007';
const NEWCOMER = '100000000000000008';
// Past the 1000 filler members, so only the second member page lists it.
const LAST_PAGE = '300000000000000000';

const discord = serveDiscord(
	{ [CONTRIBUTOR]: { username: 'carl', global_name: 'Carl', avatar: 'c4' } },
	{
		guilds: {
			[GUILD]: {
				[ADMIN]: [IDS.admin, OTHER_ROLE],
				[STAFF]: [IDS.staff],
				[DEVELOPER]: [IDS['development-team'], IDS.contributor],
				[CONTRIBUTOR]: [IDS.contributor],
				[FORMER_MODERATOR]: [OTHER_ROLE],
				[FORMER_ADMIN]: [],
				[CI]: [IDS.admin],
				[NEWCOMER]: [IDS.staff],
			},
		},
	},
);
const { ctx, close } = await createTestContext({
	DISCORD_API_URL: discord.apiUrl,
	DISCORD_GUILD_ID: GUILD,
});
const members = discord.guilds.get(GUILD) ?? new Map<string, string[]>();
const users: Record<string, string> = {};

afterAll(async () => {
	await close();
	await discord.stop();
});

async function signIn(discordId: string, role: string) {
	const { userId } = await signInWithDiscord(ctx, {
		id: discordId,
		name: `User ${discordId}`,
		email: `${discordId}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));
	users[discordId] = userId;

	return userId;
}

async function roleOf(discordId: string) {
	const [row] = await ctx.db
		.select({ role: user.role })
		.from(user)
		.where(eq(user.id, users[discordId] ?? ''));

	return row?.role;
}

async function snapshot() {
	const rows = await ctx.db.select().from(teamMember).orderBy(teamMember.discordId);

	return rows.map((row) => [row.discordId, row.group, row.staffRole]);
}

beforeAll(async () => {
	await signIn(ADMIN, 'user');
	await signIn(STAFF, 'developer');
	await signIn(DEVELOPER, 'user');
	await signIn(FORMER_MODERATOR, 'moderator');
	await signIn(FORMER_ADMIN, 'admin');
	await signIn(CI, 'ci');

	const maintainer = users[FORMER_MODERATOR] ?? '';

	await seedApprovedAddon(ctx, maintainer, manifest('former.plugin'));
	await ctx.db.update(user).set({ role: 'moderator' }).where(eq(user.id, maintainer));
});

describe('deriveStanding', () => {
	test('places a member in their highest group and grants staff site roles', () => {
		expect(deriveStanding([IDS.admin, IDS.staff], IDS)).toEqual({
			group: 'staff',
			staffRole: 'admin',
		});
		expect(deriveStanding([IDS.staff], IDS)).toEqual({
			group: 'staff',
			staffRole: 'moderator',
		});
		expect(deriveStanding([IDS.contributor, IDS.staff, IDS['development-team']], IDS)).toEqual({
			group: 'development-team',
			staffRole: 'admin',
		});
		expect(deriveStanding([IDS.management, IDS.staff], IDS)).toEqual({
			group: 'staff',
			staffRole: 'admin',
		});
		expect(deriveStanding([IDS.contributor], IDS)).toEqual({
			group: 'contributor',
			staffRole: null,
		});
		expect(deriveStanding([OTHER_ROLE], IDS)).toBeUndefined();
	});
});

describe('readTeamSyncConfig', () => {
	test('stays off and names every unset role id', () => {
		expect(readTeamSyncConfig(ctx.env)).toEqual({
			kind: 'off',
			missing: [
				'DISCORD_ADMIN_ROLE_ID',
				'DISCORD_STAFF_ROLE_ID',
				'DISCORD_DEVELOPMENT_TEAM_ROLE_ID',
				'DISCORD_MANAGEMENT_ROLE_ID',
			],
		});
	});
});

describe('syncTeam', () => {
	test('snapshots the team, caches profiles and assigns site roles as the system', async () => {
		const result = await syncTeam(ctx, IDS);

		expect(result.lockoutGuard).toBe(false);
		expect(await snapshot()).toEqual([
			[ADMIN, 'staff', 'admin'],
			[STAFF, 'staff', 'moderator'],
			[DEVELOPER, 'development-team', 'admin'],
			[CONTRIBUTOR, 'contributor', null],
			[CI, 'staff', 'admin'],
			[NEWCOMER, 'staff', 'moderator'],
		]);
		expect(await roleOf(ADMIN)).toBe('admin');
		expect(await roleOf(STAFF)).toBe('moderator');
		expect(await roleOf(DEVELOPER)).toBe('admin');
		expect(await roleOf(FORMER_MODERATOR)).toBe('developer');
		expect(await roleOf(FORMER_ADMIN)).toBe('user');
		expect(await roleOf(CI)).toBe('ci');

		const [profile] = await ctx.db
			.select()
			.from(discordProfile)
			.where(eq(discordProfile.discordId, CONTRIBUTOR));

		expect(profile).toMatchObject({ username: 'carl', globalName: 'Carl', avatarHash: 'c4' });

		const events = await ctx.db
			.select()
			.from(moderationEvent)
			.where(
				and(
					eq(moderationEvent.kind, 'user.role_set'),
					eq(moderationEvent.subjectId, users[ADMIN] ?? ''),
				),
			);

		expect(events).toMatchObject([{ actorId: null, data: { role: 'admin' } }]);
	});

	test('changes nothing when run again', async () => {
		expect((await syncTeam(ctx, IDS)).changes).toEqual([]);
	});

	test('writes nothing when a later member page fails', async () => {
		const before = await snapshot();

		for (let index = 0; index < 1000; index++) {
			members.set(String(200_000_000_000_000_000n + BigInt(index)), []);
		}

		members.set(STAFF, []);
		members.set(LAST_PAGE, [IDS.contributor]);
		discord.overrideMembers((after) =>
			after === '0' ? undefined : Response.json({ message: 'Oops' }, { status: 500 }),
		);

		try {
			const error = await syncTeam(ctx, IDS).then(
				() => null,
				(cause: unknown) => cause,
			);

			expect(String(error)).toMatch(/500/);
		} finally {
			discord.overrideMembers(null);
		}

		expect(await snapshot()).toEqual(before);
		expect(await roleOf(STAFF)).toBe('moderator');
	});

	test('pages through every member', async () => {
		const result = await syncTeam(ctx, IDS);

		expect(result.changes).toEqual([
			{ userId: users[STAFF] ?? '', from: 'moderator', to: 'user' },
		]);
		expect(await snapshot()).toContainEqual([LAST_PAGE, 'contributor', null]);
	});

	test('demotes no one when no member holds a role granting admin', async () => {
		members.set(ADMIN, [IDS.contributor]);
		members.set(DEVELOPER, [IDS.contributor]);
		members.set(CI, []);
		members.set(NEWCOMER, [IDS.contributor]);

		const result = await syncTeam(ctx, IDS);

		expect(result.lockoutGuard).toBe(true);
		expect(result.changes).toEqual([]);
		expect(await roleOf(ADMIN)).toBe('admin');
		expect(await snapshot()).toContainEqual([ADMIN, 'contributor', null]);

		members.set(ADMIN, [IDS.admin]);
		members.set(DEVELOPER, [IDS['development-team'], IDS.contributor]);
		members.set(NEWCOMER, [IDS.staff]);
		await syncTeam(ctx, IDS);
	});
});

describe('signing in', () => {
	test('grants the staff role the team snapshot names, and nothing to others', async () => {
		const newcomer = await signInWithDiscord(ctx, {
			id: NEWCOMER,
			name: 'Newcomer',
			email: 'newcomer@example.com',
		});
		const nobody = await signInWithDiscord(ctx, {
			id: '100000000000000009',
			name: 'Nobody',
			email: 'nobody@example.com',
		});
		const rows = await ctx.db
			.select({ id: user.id, role: user.role })
			.from(user)
			.where(inArray(user.id, [newcomer.userId, nobody.userId]));
		const roles = new Map(rows.map((row) => [row.id, row.role]));
		const events = await ctx.db
			.select()
			.from(moderationEvent)
			.where(eq(moderationEvent.subjectId, newcomer.userId));

		expect(roles.get(newcomer.userId)).toBe('moderator');
		expect(roles.get(nobody.userId)).toBe('user');
		expect(events).toMatchObject([
			{ kind: 'user.role_set', actorId: null, data: { role: 'moderator' } },
		]);
	});
});
