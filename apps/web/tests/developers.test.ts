import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { getDeveloper, listDevelopers } from '~/lib/developers';
import type { ManifestAuthor } from '~/lib/authors/resolve';
import type { TeamRoleIds } from '~/lib/team/roles';
import { addon, teamMember } from '~/db/schema';
import { ApiError } from '~/lib/api/errors';
import { syncTeam } from '~/lib/team/sync';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { serveDiscord } from './helpers/discord';
import { addTeamMembers } from './helpers/team';

const GUILD = '950850315601711176';
const IDS: TeamRoleIds = {
	admin: '900000000000000001',
	staff: '900000000000000002',
	'development-team': '900000000000000003',
	contributor: '900000000000000004',
	management: '900000000000000005',
	'addon-developer': '900000000000000006',
};

const ALICE = '100000000000000001';
const ERIN = '100000000000000002';
const FRANK = '100000000000000003';
const DANA = '100000000000000004';
const ZED = '100000000000000005';
const CARL = '100000000000000006';
const ADA = '100000000000000007';
const AARON = '100000000000000008';
const ZOE = '100000000000000009';

const discord = serveDiscord(
	{
		[ALICE]: { username: 'alice', global_name: 'Alice' },
		[ZED]: { username: 'zed', global_name: 'Zed', avatar: 'z1' },
		[CARL]: { username: 'carl' },
		[AARON]: { username: 'aaron', global_name: 'Aaron' },
		[ZOE]: { username: 'zoe', global_name: 'Zoe' },
		[ADA]: { username: 'ada', global_name: 'Ada' },
	},
	{
		guilds: {
			[GUILD]: {
				[ALICE]: [IDS.staff, IDS.admin],
				[ZED]: [IDS['development-team']],
				[CARL]: [IDS.contributor],
			},
		},
	},
);
const { ctx, close } = await createTestContext({
	DEVELOPER_LIST_PAGE_SIZE: '2',
	DISCORD_API_URL: discord.apiUrl,
	DISCORD_GUILD_ID: GUILD,
});

afterAll(async () => {
	await close();
	await discord.stop();
});

function names(search: string) {
	return listDevelopers(ctx, { search }).then((result) =>
		result.developers.map((developer) => developer.author.name),
	);
}

async function listAll(search: string = '') {
	const pages: string[][][] = [];
	let cursor: string | undefined;

	do {
		const page = await listDevelopers(ctx, { search, cursor });

		pages.push(page.developers.map(({ author, group }) => [author.name, group]));
		cursor = page.nextCursor ?? undefined;
	} while (cursor);

	return pages;
}

async function publish(id: string, authors: ManifestAuthor[], ownerId: string) {
	await seedApprovedAddon(ctx, ownerId, manifest(id, '1.0.0', { authors }));
}

beforeAll(async () => {
	const ci = await signInWithDiscord(ctx, {
		id: '100000000000000099',
		name: 'Unbound CI',
		email: 'ci@example.com',
	});

	await signInWithDiscord(ctx, { id: FRANK, name: 'Franklin', email: 'frank@example.com' });
	await publish('alice.plugin', [{ name: 'Alice', id: ALICE }], ci.userId);
	await publish(
		'erin.plugin',
		[
			{ name: 'Erin 100%', id: ERIN },
			{ name: 'Ally', id: ALICE },
		],
		ci.userId,
	);
	await publish(
		'frank.plugin',
		[
			{ name: 'Frank', id: FRANK },
			{ name: 'Anon', id: '0' },
		],
		ci.userId,
	);
	await publish('dana.plugin', [{ name: 'Dana', id: DANA }], ci.userId);
	await ctx.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, 'dana.plugin'));
	await addTeamMembers(ctx, [ZED, CARL]);
	await syncTeam(ctx, IDS);
});

describe('listDevelopers', () => {
	test('lists the team by group, then credited authors, a page at a time', async () => {
		const first = await listDevelopers(ctx, { search: '' });

		expect(
			first.developers.map(({ author, addonCount, group }) => [
				author.discordId,
				author.name,
				addonCount,
				group,
			]),
		).toEqual([
			[ZED, 'Zed', 0, 'development-team'],
			[ALICE, 'Alice', 2, 'staff'],
		]);
		expect(await listAll()).toEqual([
			[
				['Zed', 'development-team'],
				['Alice', 'staff'],
			],
			[
				['carl', 'contributor'],
				['Erin 100%', 'addon-developer'],
			],
			[['Franklin', 'addon-developer']],
		]);
	});

	test('continues a page from its cursor when someone joins before it', async () => {
		const first = await listDevelopers(ctx, { search: '' });

		discord.guilds.get(GUILD)?.set(ADA, [IDS['development-team']]);
		await addTeamMembers(ctx, [ADA]);
		await syncTeam(ctx, IDS);

		const second = await listDevelopers(ctx, { search: '', cursor: first.nextCursor ?? '' });

		expect(second.developers.map(({ author }) => author.name)).toEqual(['carl', 'Erin 100%']);
		expect((await listAll())[0]).toEqual([
			['Ada', 'development-team'],
			['Zed', 'development-team'],
		]);

		discord.guilds.get(GUILD)?.delete(ADA);
		await syncTeam(ctx, IDS);
	});

	test('rejects a cursor from another list', async () => {
		const error = await listDevelopers(ctx, { search: '', cursor: 'bm9wZQ' }).then(
			() => null,
			(cause: unknown) => cause,
		);

		expect(error).toBeInstanceOf(ApiError);
	});

	test('shows a linked account under its Unbound name', async () => {
		const [franklin] = (await listDevelopers(ctx, { search: 'frank' })).developers;

		expect(franklin?.author).toMatchObject({
			kind: 'user',
			name: 'Franklin',
			discordId: FRANK,
		});
	});

	test('searches resolved and manifest names case-insensitively and literally', async () => {
		expect(await names('ALI')).toEqual(['Alice']);
		expect(await names('ally')).toEqual(['Alice']);
		expect(await names('ze')).toEqual(['Zed']);
		expect(await names('%')).toEqual(['Erin 100%']);
		expect(await names('_')).toEqual([]);
		expect(await names('dana')).toEqual([]);
		expect(await names('anon')).toEqual([]);
	});
});

describe('staff order', () => {
	test('lists admins before moderators, then by manual position', async () => {
		discord.guilds.get(GUILD)?.set(AARON, [IDS.staff]);
		discord.guilds.get(GUILD)?.set(ZOE, [IDS.staff, IDS.admin]);
		await addTeamMembers(ctx, [AARON, ZOE]);
		await syncTeam(ctx, IDS);
		await ctx.db.update(teamMember).set({ position: 0 }).where(eq(teamMember.discordId, ZOE));

		try {
			const staff = (await listAll()).flat().filter(([, group]) => group === 'staff');

			expect(staff.map(([name]) => name)).toEqual(['Zoe', 'Alice', 'Aaron']);
		} finally {
			discord.guilds.get(GUILD)?.delete(AARON);
			discord.guilds.get(GUILD)?.delete(ZOE);
			await syncTeam(ctx, IDS);
		}
	});
});

describe('getDeveloper', () => {
	test('loads the listed addons that credit an id', async () => {
		const developer = await getDeveloper(ctx, ALICE);

		expect(developer?.author).toMatchObject({ kind: 'discord', name: 'Alice' });
		expect(developer?.group).toBe('staff');
		expect(developer?.addons.map((entry) => entry.id)).toEqual(['alice.plugin', 'erin.plugin']);
	});

	test('loads a team member no listed addon credits', async () => {
		const developer = await getDeveloper(ctx, ZED);

		expect(developer?.author).toMatchObject({ kind: 'discord', name: 'Zed', username: 'zed' });
		expect(developer?.group).toBe('development-team');
		expect(developer?.addons).toEqual([]);
	});

	test('finds nothing for an id only a delisted addon credits, or for 0', async () => {
		expect(await getDeveloper(ctx, DANA)).toBeUndefined();
		expect(await getDeveloper(ctx, '0')).toBeUndefined();
	});
});
