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

import { linkGitHub, manifest, seedApprovedAddon, seedSponsorship } from '@unbound-app/web/testing';
import type { Member } from '@unbound-app/web/bot';

import {
	createRolesDispatcher,
	parseMemberPayload,
	qualifyingRoles,
	type RolesOptions,
} from '~/dispatchers/roles';
import { createContributorCache } from '~/lib/github-contributors';
import { roleGrant } from '~/db/schema';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from './helpers/database';
import { FAKE_GUILD_ID, GUILD_ROLES, fakeDiscord } from './helpers/roles-discord';
import { createFakeReads, MEMBER, type FakeReads } from './helpers/fake-reads';
import { fakeGitHub } from './helpers/github-fetch';
import { signUp } from './helpers/web';

const HOUR = 60 * 60 * 1000;
const ROLE_IDS = { contributor: 'r-c', addonDeveloper: 'r-a', sponsor: 'r-s' };
const CONTRIBUTORS = new Set(['42']);

const ROW: Member = {
	userId: 'user-1',
	discordId: '1',
	githubId: '42',
	isAddonDeveloper: true,
	isSponsor: true,
};
const USER_PAYLOAD = `user:${MEMBER.userId}`;

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

	test('Contributor matches the GitHub id', () => {
		expect(qualifyingRoles({ ...ROW, githubId: '7' }, CONTRIBUTORS).has('contributor')).toBe(
			false,
		);
	});

	test('without a contributor list only the flag roles qualify', () => {
		expect(qualifyingRoles(ROW, undefined)).toEqual(new Set(['addonDeveloper', 'sponsor']));
	});

	test('is empty when GitHub is not linked', () => {
		expect(qualifyingRoles({ ...ROW, githubId: null }, CONTRIBUTORS).size).toBe(0);
	});
});

describe('parseMemberPayload', () => {
	test('reads the subjects the triggers write and rejects anything else', () => {
		expect(parseMemberPayload('user:abc')).toEqual({ by: 'user', ids: ['abc'] });
		expect(parseMemberPayload('github:42')).toEqual({ by: 'github', ids: ['42'] });
		expect(parseMemberPayload('addon:acme.plugin')).toEqual({
			by: 'addon',
			ids: ['acme.plugin'],
		});
		expect(parseMemberPayload('discord:1')).toBeUndefined();
		expect(parseMemberPayload('user:')).toBeUndefined();
		expect(parseMemberPayload('abc')).toBeUndefined();
	});
});

describe.skipIf(!DATABASE_URL)('roles dispatcher', () => {
	let database: BotTestDatabase;
	let fake: FakeReads;
	const error = spyOn(console, 'error').mockImplementation(() => undefined);
	const info = spyOn(console, 'info').mockImplementation(() => void 0);
	const debug = spyOn(console, 'debug').mockImplementation(() => void 0);

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	beforeEach(async () => {
		await database.db.delete(roleGrant);
		fake = createFakeReads();
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
	});

	function seed(...rows: Partial<Member>[]) {
		for (const row of rows) {
			const item = { ...MEMBER, isAddonDeveloper: false, ...row };
			const index = fake.members.findIndex((entry) => entry.userId === item.userId);

			fake.members.splice(index < 0 ? fake.members.length : index, 1, item);
		}
	}

	function context(client: ReturnType<typeof fakeDiscord>['client']) {
		return { db: database.db, web: fake.reads, client };
	}

	function grants() {
		return database.db
			.select({ discordId: roleGrant.discordId, role: roleGrant.role })
			.from(roleGrant);
	}

	test('grants Contributor when github_id is a contributor id, not by login', async () => {
		seed(
			{ userId: 'a', discordId: '1', githubId: '42' },
			{ userId: 'b', discordId: '2', githubId: '7' },
		);
		const discord = fakeDiscord({ members: { '1': [], '2': [] } });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
	});

	test('grants Addon Developer and Sponsor from the member flags', async () => {
		seed({ githubId: '7', isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([
			{ discordId: '1', roleId: 'r-a' },
			{ discordId: '1', roleId: 'r-s' },
		]);
	});

	test('with no contributor list, grants Addon Developer and Sponsor but not Contributor', async () => {
		seed({ isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher({ contributors: { get: async () => undefined } });

		await roles.reconcile(context(discord.client));

		expect(discord.added.map((grant) => grant.roleId)).toEqual(['r-a', 'r-s']);
	});

	test('grants nothing when github_id is null', async () => {
		seed({ githubId: null, isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([]);
		expect(discord.fetched).toEqual([]);
	});

	test('a member who unlinks Discord is granted nothing more and keeps earlier grants', async () => {
		seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher();
		const current = context(discord.client);

		await roles.reconcile(current);
		fake.members.length = 0;
		await roles.handle(USER_PAYLOAD, current);
		await roles.reconcile(current);

		expect(discord.added).toEqual([
			{ discordId: '1', roleId: 'r-c' },
			{ discordId: '1', roleId: 'r-s' },
		]);
		expect(discord.held('1')).toEqual(new Set(['r-c', 'r-s']));
		expect(await grants()).toHaveLength(2);
	});

	test('adds the role, then writes role_grant with the role id', async () => {
		seed({});
		const discord = fakeDiscord({ members: { '1': [] } });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.held('1')).toEqual(new Set(['r-c']));
		expect(await grants()).toEqual([{ discordId: '1', role: 'r-c' }]);
	});

	test('skips a held role and writes no role_grant', async () => {
		seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': ['r-c'] } });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-s' }]);
		expect(await grants()).toEqual([{ discordId: '1', role: 'r-s' }]);
	});

	test('a second reconcile makes no Discord calls', async () => {
		seed({ isAddonDeveloper: true, isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher();
		const current = context(discord.client);

		await roles.reconcile(current);
		const fetched = discord.fetched.length;

		await roles.reconcile(current);

		expect(discord.fetched).toHaveLength(fetched);
		expect(discord.added).toHaveLength(3);
	});

	test('a role held by hand costs no Discord call on the next reconcile', async () => {
		seed({});
		const discord = fakeDiscord({ members: { '1': ['r-c'] } });
		const roles = dispatcher();
		const current = context(discord.client);

		await roles.reconcile(current);
		await roles.reconcile(current);
		await roles.handle(USER_PAYLOAD, current);

		expect(discord.fetched).toEqual(['1']);
		expect(discord.added).toEqual([]);
		expect(await grants()).toEqual([]);
	});

	test('an absent member who later enters the guild is granted on the next reconcile, with no guildMemberAdd', async () => {
		seed({});
		const discord = fakeDiscord({ members: {} });
		const roles = dispatcher();
		const current = context(discord.client);

		await roles.reconcile(current);
		expect(discord.added).toEqual([]);

		discord.enter('1');
		await roles.reconcile(current);

		expect(discord.fetched).toEqual(['1', '1']);
		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
		expect(await grants()).toEqual([{ discordId: '1', role: 'r-c' }]);
	});

	test('a deleted account is not fetched again for an hour', async () => {
		seed({});
		const discord = fakeDiscord({ members: {}, deleted: ['1'] });
		let clock = 0;
		const roles = dispatcher({ now: () => clock });
		const current = context(discord.client);

		await roles.reconcile(current);
		clock = HOUR - 1;
		await roles.reconcile(current);
		await roles.handle(USER_PAYLOAD, current);
		expect(discord.fetched).toEqual(['1']);

		clock = HOUR;
		await roles.reconcile(current);
		expect(discord.fetched).toEqual(['1', '1']);
	});

	test('a deleted account (10013 Unknown User) is skipped quietly like an absent member', async () => {
		seed({});
		const discord = fakeDiscord({ members: {}, deleted: ['1'] });
		const roles = dispatcher();
		const current = context(discord.client);

		await roles.reconcile(current);
		await roles.reconcile(current);

		expect(discord.fetched).toEqual(['1']);
		expect(logged(error)).toBe('');
	});

	test('does not re-add a role the bot granted after a moderator removed it', async () => {
		seed({});
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher();
		const current = context(discord.client);

		await roles.reconcile(current);
		discord.held('1')?.delete('r-c');
		await roles.reconcile(current);
		await roles.handle(USER_PAYLOAD, current);

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
		expect(discord.held('1')).toEqual(new Set());
	});

	test('a member who stops qualifying keeps their roles', async () => {
		seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher({ contributors: { get: async () => new Set<string>() } });
		const current = context(discord.client);

		await roles.reconcile(current);
		seed({ isSponsor: false });
		await roles.handle(USER_PAYLOAD, current);

		expect(discord.held('1')).toEqual(new Set(['r-s']));
	});

	test('skips an absent member and writes nothing, then grants on join', async () => {
		seed({});
		const discord = fakeDiscord({ members: {} });
		const roles = dispatcher();

		await roles.reconcile(context(discord.client));

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
		seed(
			{ userId: 'a', githubId: '7', isSponsor: true },
			{ userId: 'b', githubId: '8', isAddonDeveloper: true },
		);
		const discord = fakeDiscord({ members: {} });
		const roles = dispatcher();

		await roles.reconcile(context(discord.client));
		discord.join('1');
		await roles.drain();

		expect(discord.fetched).toEqual(['1', '1']);
		expect(discord.added.map((grant) => grant.roleId).toSorted()).toEqual(['r-a', 'r-s']);
	});

	test("logs which role to move when the bot's highest role is at or below a target, still grants the others", async () => {
		seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] }, aboveBot: ['r-s'] });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
		expect(logged(error)).toContain(
			'Cannot grant "Sponsor" (position 6): the bot\'s highest role "Unbound" (position 5) is not above it. In Server Settings > Roles, drag "Unbound" above "Sponsor".',
		);
	});

	test('logs a guild problem once while it persists, again when it changes, and once when it clears', async () => {
		seed({ isAddonDeveloper: true, isSponsor: true });
		const members = { '1': [] };
		const sponsorAbove = fakeDiscord({ members, aboveBot: ['r-s'] });
		const bothAbove = fakeDiscord({ members, aboveBot: ['r-s', 'r-a'] });
		const fixed = fakeDiscord({ members });
		const roles = dispatcher();

		await roles.reconcile(context(sponsorAbove.client));
		await roles.reconcile(context(sponsorAbove.client));
		expect(count(error, 'Cannot grant "Sponsor"')).toBe(1);

		await roles.reconcile(context(bothAbove.client));
		expect(count(error, 'Cannot grant "Sponsor"')).toBe(2);
		expect(count(error, 'Cannot grant "Addon Developer"')).toBe(1);

		await roles.reconcile(context(fixed.client));
		await roles.reconcile(context(fixed.client));
		expect(fixed.added).toEqual([{ discordId: '1', roleId: 'r-s' }]);
		expect(count(info, 'Role grants are unblocked')).toBe(1);
	});

	test('logs a role missing from the guild and still grants the others', async () => {
		seed({ isSponsor: true });
		const guildRoles = GUILD_ROLES.filter((role) => role.id !== 'r-c');
		const discord = fakeDiscord({ members: { '1': [] }, guildRoles });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-s' }]);
		expect(logged(error)).toContain(
			`Cannot grant contributor: role CONTRIBUTOR_ROLE_ID=r-c does not exist in guild ${FAKE_GUILD_ID}.`,
		);
	});

	test('logs missing Manage Roles and grants nothing', async () => {
		seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] }, manageRoles: false });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([]);
		expect(discord.fetched).toEqual([]);
		expect(logged(error)).toContain('the bot\'s role "Unbound" lacks Manage Roles');
	});

	test("a 50013 on one role still grants each member's other roles and is logged once", async () => {
		seed(
			{ userId: 'a', discordId: '1', isSponsor: true },
			{ userId: 'b', discordId: '2', isSponsor: true },
		);
		const discord = fakeDiscord({ members: { '1': [], '2': [] }, failAdd: ['r-c'] });

		await dispatcher().reconcile(context(discord.client));

		expect(discord.added).toEqual([
			{ discordId: '1', roleId: 'r-s' },
			{ discordId: '2', roleId: 'r-s' },
		]);
		expect(count(error, 'Missing Permissions (50013)')).toBe(1);
	});

	test('concurrent reconcile, handle and join add each role once', async () => {
		seed({ isSponsor: true });
		const discord = fakeDiscord({ members: { '1': [] } });
		const roles = dispatcher();
		const current = context(discord.client);
		const reconciled = roles.reconcile(current);

		discord.join('1');
		await Promise.all([reconciled, roles.handle(USER_PAYLOAD, current), roles.drain()]);

		expect(discord.added.map((grant) => grant.roleId)).toEqual(['r-c', 'r-s']);
		expect(discord.fetched).toEqual(['1']);
	});

	test('two reconciles attach one guildMemberAdd listener', async () => {
		const discord = fakeDiscord({ members: {} });
		const roles = dispatcher();
		const current = context(discord.client);

		await roles.reconcile(current);
		await roles.reconcile(current);

		expect(discord.listeners).toBe(1);
	});

	test("a reconcile after the cache's refresh interval picks up a new contributor", async () => {
		seed({ githubId: '5' });
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
		const current = context(discord.client);

		await roles.reconcile(current);
		client.push([{ id: 5 }]);
		await roles.reconcile(current);
		expect(discord.added).toEqual([]);

		clock = 1000;
		await roles.reconcile(current);
		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-c' }]);
	});

	test('a github: or addon: payload syncs only the members it names', async () => {
		seed(
			{ userId: 'a', discordId: '1', githubId: '7', isSponsor: true },
			{ userId: 'b', discordId: '2', githubId: '8', isAddonDeveloper: true },
		);
		fake.maintainers.set('acme.plugin', ['b']);
		const discord = fakeDiscord({ members: { '1': [], '2': [] } });
		const roles = dispatcher();

		await roles.handle('github:7', context(discord.client));
		expect(discord.added).toEqual([{ discordId: '1', roleId: 'r-s' }]);

		await roles.handle('addon:acme.plugin', context(discord.client));
		await roles.handle('discord:2', context(discord.client));
		expect(discord.added).toEqual([
			{ discordId: '1', roleId: 'r-s' },
			{ discordId: '2', roleId: 'r-a' },
		]);
	});

	test('linking GitHub on the web, as a sponsoring addon developer, grants both roles', async () => {
		const member = await signUp(database.web);
		const discord = fakeDiscord({ members: { [member.discordId]: [] } });
		const roles = dispatcher({ contributors: { get: async () => new Set<string>() } });
		const real = { db: database.db, web: database.reads, client: discord.client };

		await seedApprovedAddon(database.web, member.userId, manifest('roles.addon'));
		await seedSponsorship(database.web, { githubId: member.userId });
		await roles.handle(`user:${member.userId}`, real);
		expect(discord.added).toEqual([]);

		await linkGitHub(database.web, member.userId, 'token');
		await roles.handle(`user:${member.userId}`, real);

		expect(discord.added).toEqual([
			{ discordId: member.discordId, roleId: 'r-a' },
			{ discordId: member.discordId, roleId: 'r-s' },
		]);
		expect(await grants()).toHaveLength(2);
	});
});
