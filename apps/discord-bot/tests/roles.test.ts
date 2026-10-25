import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from 'bun:test';

import {
	createRolesDispatcher,
	qualifyingRoles,
	type MemberRow,
	type RolesOptions,
} from '~/dispatchers/roles';
import { createContributorCache } from '~/lib/github-contributors';
import type { MemberFeedItem } from '~/lib/feed/types';
import { member, roleGrant } from '~/db/schema';
import { feeds } from '~/lib/feed/feeds';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	type TestDatabase,
} from './helpers/database';
import { FAKE_GUILD_ID, GUILD_ROLES, fakeDiscord } from './helpers/roles-discord';
import { fakeGitHub } from './helpers/github-fetch';
import { MEMBER } from './helpers/feeds';

const HOUR = 60 * 60 * 1000;
const ROLE_IDS = { contributor: 'r-c', addonDeveloper: 'r-a', sponsor: 'r-s' };
const CONTRIBUTORS = new Set(['42']);

const ROW: MemberRow = {
	userId: 'user-1',
	discordId: '1',
	githubId: '42',
	githubLogin: null,
	isAddonDeveloper: true,
	isSponsor: true,
	updatedAt: new Date(0),
};

function logged(spy: ReturnType<typeof spyOn>) {
	return spy.mock.calls.flat().map(String).join('\n');
}

function dispatcher(overrides: RolesOptions = {}) {
	return createRolesDispatcher({
		guildId: FAKE_GUILD_ID,
		roleIds: ROLE_IDS,
		contributors: { get: async () => CONTRIBUTORS },
		...overrides,
	});
}

describe('qualifyingRoles', () => {
	test('a contributor id, the addon developer flag and the sponsor flag each qualify', () => {
		expect(qualifyingRoles(ROW, CONTRIBUTORS)).toEqual(
			new Set(['contributor', 'addonDeveloper', 'sponsor']),
		);
	});

	test('Contributor matches the GitHub id, never the login', () => {
		const row = { ...ROW, githubId: '7', githubLogin: '42' };

		expect(qualifyingRoles(row, CONTRIBUTORS).has('contributor')).toBe(false);
	});

	test('without a contributor list only the flag roles qualify', () => {
		expect(qualifyingRoles(ROW, undefined)).toEqual(new Set(['addonDeveloper', 'sponsor']));
	});

	test('is empty when GitHub is not linked', () => {
		expect(qualifyingRoles({ ...ROW, githubId: null }, CONTRIBUTORS).size).toBe(0);
	});

	test('is empty for an empty discord id', () => {
		expect(qualifyingRoles({ ...ROW, discordId: '' }, CONTRIBUTORS).size).toBe(0);
	});
});

describe.skipIf(!DATABASE_URL)('roles dispatcher', () => {
	let database: TestDatabase;
	const error = spyOn(console, 'error').mockImplementation(() => undefined);
	const info = spyOn(console, 'info').mockImplementation(() => void 0);
	const debug = spyOn(console, 'debug').mockImplementation(() => void 0);

	beforeAll(async () => {
		database = await createTestDatabase();
	});

	beforeEach(async () => {
		await database.db.delete(member);
		await database.db.delete(roleGrant);
	});

	afterEach(() => {
		error.mockClear();
		info.mockClear();
	});

	function count(spy: ReturnType<typeof spyOn>, text: string) {
		return spy.mock.calls.filter((call) => call.map(String).join(' ').includes(text)).length;
	}

	afterAll(async () => {
		error.mockRestore();
		info.mockRestore();
		debug.mockRestore();
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	async function seed(...rows: Partial<MemberFeedItem>[]) {
		const items = rows.map((row) => ({ ...MEMBER, isAddonDeveloper: false, ...row }));

		await database.db.transaction((tx) => feeds.members.ingest(tx, items));
	}

	function grants() {
		return database.db
			.select({ discordId: roleGrant.discordId, role: roleGrant.role })
			.from(roleGrant);
	}

	test('grants Contributor when github_id is a contributor id, not by login', async () => {
		await seed(
			{ userId: 'a', discordId: '1', githubId: '42', githubLogin: 'someone' },
			{ userId: 'b', discordId: '2', githubId: '7', githubLogin: '42' },
		);
		const discord = fakeDiscord({ members: { '1': [], '2': [] } });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
	});

	test('grants Addon Developer and Sponsor from the member flags', async () => {
		await seed({ githubId: '7', isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([
			{ discordId: '1', roleId: 'r-a' },
			{ discordId: '1', roleId: 'r-s' },
		]);
	});

	test('with no contributor list, grants Addon Developer and Sponsor but not Contributor', async () => {
		await seed({ isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher({ contributors: { get: async () => undefined } });

		await roles.reconcile({ db: database.db, client: discord.client });

		expect(discord.added.map((grant) => grant.roleId)).toEqual(['r-a', 'r-s']);
	});

	test('grants nothing when github_id is null', async () => {
		await seed({ githubId: undefined, isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([]);
		expect(discord.fetched).toEqual([]);
	});

	test('adds the role, then writes role_grant with the role id', async () => {
		await seed({});
		const discord = fakeDiscord({ members: { '1': [] } });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.held('1')).toEqual(new Set(['r-c']));
		expect(await grants()).toEqual([{ discordId: '1', role: 'r-c' }]);
	});

	test('skips a held role and writes no role_grant', async () => {
		await seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': ['r-c'] } });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-s' }]);
		expect(await grants()).toEqual([{ discordId: '1', role: 'r-s' }]);
	});

	test('a second reconcile makes no Discord calls', async () => {
		await seed({ isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher();
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		const fetched = discord.fetched.length;

		await roles.reconcile(context);

		expect(discord.fetched).toHaveLength(fetched);
		expect(discord.added).toHaveLength(3);
	});

	test('a role held by hand costs no Discord call on the next reconcile', async () => {
		await seed({});
		const discord = fakeDiscord({ members: { '1': ['r-c'] } });
		const roles = dispatcher();
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		await roles.reconcile(context);
		await roles.handle(MEMBER.userId, context);

		expect(discord.fetched).toEqual(['1']);
		expect(discord.added).toEqual([]);
		expect(await grants()).toEqual([]);
	});

	test('an absent member is not fetched again for an hour', async () => {
		await seed({});
		const discord = fakeDiscord({ members: {} });
		let clock = 0;
		const roles = dispatcher({ now: () => clock });
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		clock = HOUR - 1;
		await roles.reconcile(context);
		await roles.handle(MEMBER.userId, context);
		expect(discord.fetched).toEqual(['1']);

		clock = HOUR;
		await roles.reconcile(context);
		expect(discord.fetched).toEqual(['1', '1']);
	});

	test('a deleted account (10013 Unknown User) is skipped quietly like an absent member', async () => {
		await seed({});
		const discord = fakeDiscord({ members: {}, deleted: ['1'] });
		const roles = dispatcher();
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		await roles.reconcile(context);

		expect(discord.fetched).toEqual(['1']);
		expect(logged(error)).toBe('');
	});

	test('does not re-add a role the bot granted after a moderator removed it', async () => {
		await seed({});
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher();
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		discord.held('1')?.delete('r-c');
		await roles.reconcile(context);
		await roles.handle(MEMBER.userId, context);

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
		expect(discord.held('1')).toEqual(new Set());
	});

	test('a member who stops qualifying keeps their roles', async () => {
		await seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher({ contributors: { get: async () => new Set<string>() } });
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		await seed({ isSponsor: false });
		await roles.handle(MEMBER.userId, context);

		expect(discord.held('1')).toEqual(new Set(['r-s']));
	});

	test('skips an absent member and writes nothing, then grants on join', async () => {
		await seed({});
		const discord = fakeDiscord({ members: {} });
		const roles = dispatcher();

		await roles.reconcile({ db: database.db, client: discord.client });

		expect(discord.fetched).toEqual(['1']);
		expect(await grants()).toEqual([]);
		expect(logged(error)).toBe('');

		discord.join('1', 'another-guild');
		discord.join('1');
		await roles.drain();

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
		expect(discord.fetched).toEqual(['1', '1']);
	});

	test('join grants the union of the rows sharing a discord id', async () => {
		await seed(
			{ userId: 'a', githubId: '7', isSponsor: true },
			{ userId: 'b', githubId: '8', isAddonDeveloper: true },
		);
		const discord = fakeDiscord({ members: {} });
		const roles = dispatcher();

		await roles.reconcile({ db: database.db, client: discord.client });
		discord.join('1');
		await roles.drain();

		expect(discord.fetched).toEqual(['1', '1']);
		expect(discord.added.map((grant) => grant.roleId).toSorted()).toEqual(['r-a', 'r-s']);
	});

	test("logs which role to move when the bot's highest role is at or below a target, still grants the others", async () => {
		await seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] }, aboveBot: ['r-s'] });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
		expect(logged(error)).toContain(
			'Cannot grant "Sponsor" (position 6): the bot\'s highest role "Unbound" (position 5) is not above it. In Server Settings > Roles, drag "Unbound" above "Sponsor".',
		);
	});

	test('logs a guild problem once while it persists, again when it changes, and once when it clears', async () => {
		await seed({ isAddonDeveloper: true, isSponsor: true });
		const members = { '1': [] };
		const sponsorAbove = fakeDiscord({ members, aboveBot: ['r-s'] });
		const bothAbove = fakeDiscord({ members, aboveBot: ['r-s', 'r-a'] });
		const fixed = fakeDiscord({ members });
		const roles = dispatcher();

		await roles.reconcile({ db: database.db, client: sponsorAbove.client });
		await roles.reconcile({ db: database.db, client: sponsorAbove.client });
		expect(count(error, 'Cannot grant "Sponsor"')).toBe(1);

		await roles.reconcile({ db: database.db, client: bothAbove.client });
		expect(count(error, 'Cannot grant "Sponsor"')).toBe(2);
		expect(count(error, 'Cannot grant "Addon Developer"')).toBe(1);

		await roles.reconcile({ db: database.db, client: fixed.client });
		await roles.reconcile({ db: database.db, client: fixed.client });
		expect(fixed.added).toEqual([{ discordId: '1', roleId: 'r-s' }]);
		expect(count(info, 'Role grants are unblocked')).toBe(1);
	});

	test('logs a role missing from the guild and still grants the others', async () => {
		await seed({ isSponsor: true });
		const guildRoles = GUILD_ROLES.filter((role) => role.id !== 'r-c');
		const discord = fakeDiscord({ members: { '1': [] }, guildRoles });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-s' }]);
		expect(logged(error)).toContain(
			`Cannot grant contributor: role CONTRIBUTOR_ROLE_ID=r-c does not exist in guild ${FAKE_GUILD_ID}.`,
		);
	});

	test('logs missing Manage Roles and grants nothing', async () => {
		await seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] }, manageRoles: false });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([]);
		expect(discord.fetched).toEqual([]);
		expect(logged(error)).toContain('the bot\'s role "Unbound" lacks Manage Roles');
	});

	test("a 50013 on one role still grants each member's other roles and is logged once", async () => {
		await seed(
			{ userId: 'a', discordId: '1', isSponsor: true },
			{ userId: 'b', discordId: '2', isSponsor: true },
		);
		const discord = fakeDiscord({ members: { '1': [], '2': [] }, failAdd: ['r-c'] });

		await dispatcher().reconcile({ db: database.db, client: discord.client });

		expect(discord.added).toEqual([
			{ discordId: '1', roleId: 'r-s' },
			{ discordId: '2', roleId: 'r-s' },
		]);
		expect(count(error, 'Missing Permissions (50013)')).toBe(1);
	});

	test('concurrent reconcile, handle and join add each role once', async () => {
		await seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher();
		const context = { db: database.db, client: discord.client };
		const reconciled = roles.reconcile(context);

		discord.join('1');
		await Promise.all([reconciled, roles.handle(MEMBER.userId, context), roles.drain()]);

		expect(discord.added.map((grant) => grant.roleId)).toEqual(['r-c', 'r-s']);
		expect(discord.fetched).toEqual(['1']);
	});

	test('two reconciles attach one guildMemberAdd listener', async () => {
		const discord = fakeDiscord({ members: {} });
		const roles = dispatcher();
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		await roles.reconcile(context);

		expect(discord.listeners).toBe(1);
	});

	test("a reconcile after the cache's refresh interval picks up a new contributor", async () => {
		await seed({ githubId: '5' });
		const client = [[{ id: 42 }]];
		const github = fakeGitHub({
			repos: [[{ full_name: 'unbound-app/client', fork: false }]],
			contributors: { 'unbound-app/client': client, 'marioparaschiv/unbound': 204 },
		});
		let clock = 0;
		const contributors = createContributorCache({
			fetch: github.fetch,
			refreshMs: 1000,
			now: () => clock,
		});
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher({ contributors });
		const context = { db: database.db, client: discord.client };

		await roles.reconcile(context);
		client.push([{ id: 5 }]);
		await roles.reconcile(context);
		expect(discord.added).toEqual([]);

		clock = 1000;
		await roles.reconcile(context);
		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
	});
});
