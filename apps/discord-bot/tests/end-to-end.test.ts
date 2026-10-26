import {
	createStaffNote,
	linkGitHub,
	manifest,
	schema,
	seedApprovedAddon,
	seedSponsorship,
} from '@unbound-app/web/testing';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Client } from 'discord.js';
import { eq } from 'drizzle-orm';

import { announceRelease, reconcileReleases, type ReleaseTarget } from '~/dispatchers/releases';
import { reconcileAddons, syncAddon, type AddonChannels } from '~/dispatchers/addons';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import { startDispatchers, type DiscordIds } from '~/runtime/start';
import { createAuditDispatcher } from '~/dispatchers/audit';
import { createRolesDispatcher } from '~/dispatchers/roles';
import { DISCORD_IDS } from '~/lib/constants';

import {
	createFakeDiscord as createFakeChannels,
	type FakeDiscord as FakeChannels,
} from './helpers/fake-discord-rest';
import {
	createBotTestDatabase,
	DATABASE_URL,
	waitFor,
	type BotTestDatabase,
} from './helpers/database';
import { createFakeClient, createFakeDiscord, type FakeDiscord } from './helpers/fake-discord';
import { FAKE_GUILD_ID, fakeDiscord as fakeGuild } from './helpers/roles-discord';
import { signUp } from './helpers/web';

const CHANNELS: AddonChannels = { plugin: '11', theme: '12', 'icon-pack': '13' };
const RELEASES: ReleaseTarget = { channelId: '21', roleId: '31' };
const ROLE_IDS = { contributor: 'r-c', addonDeveloper: 'r-a', sponsor: 'r-s' };
const LINKED_DISCORD_ID = '555';
// What a notification may take to reach Discord through LISTEN, the serial queue and the fake.
const NOTIFY_WITHIN_MS = 1000;
// Every id set, so the runtime starts every dispatcher.
const IDS = Object.fromEntries(Object.keys(DISCORD_IDS).map((name) => [name, '1'])) as DiscordIds;

describe.skipIf(!DATABASE_URL)('the runtime against the web database and a fake Discord', () => {
	let database: BotTestDatabase;
	let channels: FakeChannels;
	let auditLog: FakeDiscord;
	let client: Client<true>;
	let stop: () => Promise<void>;
	const guild = fakeGuild({ members: { [LINKED_DISCORD_ID]: [] }, guildId: FAKE_GUILD_ID });
	const started = new Set<string>();

	// Records each dispatcher's first reconcile, which the runtime runs once its LISTEN is up.
	function observed(dispatcher: Dispatcher): Dispatcher {
		return {
			...dispatcher,
			async reconcile(context) {
				await dispatcher.reconcile(context);
				started.add(dispatcher.name);
			},
		};
	}

	beforeAll(async () => {
		database = await createBotTestDatabase();
		channels = createFakeChannels();
		auditLog = createFakeDiscord();
		client = createFakeClient(auditLog);

		const { rest, selfId } = channels;
		const roles = createRolesDispatcher({
			guildId: FAKE_GUILD_ID,
			roleIds: ROLE_IDS,
			contributors: { get: async () => new Set<string>() },
		});
		const registered: Dispatcher[] = [
			{
				name: 'addons',
				channel: 'addon_changed',
				requires: [],
				reconcile: (context) => reconcileAddons(context, rest, selfId, CHANNELS),
				handle: (id, context) => syncAddon(context, rest, id, CHANNELS),
			},
			{
				name: 'releases',
				channel: 'loader_release',
				requires: [],
				reconcile: (context) => reconcileReleases(context, rest, selfId, RELEASES),
				handle: (payload, context) => announceRelease(context, rest, payload, RELEASES),
			},
			createAuditDispatcher(auditLog.channelId),
			{
				...roles,
				reconcile: (context) => roles.reconcile({ ...context, client: guild.client }),
				handle: (payload, context) =>
					roles.handle(payload, { ...context, client: guild.client }),
			},
		];
		const dispatchers = registered.map(observed);
		const context: DispatcherContext = { db: database.db, web: database.reads, client };

		({ stop } = startDispatchers(dispatchers, context, database.url, 60_000, IDS));
		await waitFor(() => started.size === dispatchers.length);
	});

	afterAll(async () => {
		await stop();
		await client.destroy();
		auditLog.stop();
		await channels.stop();
		await database.drop();
	});

	test('publishing a plugin posts exactly one #plugins message within a second; a delist deletes it', async () => {
		const owner = await signUp(database.web);
		const posted = () =>
			channels
				.messages('11')
				.filter((message) => message.embeds[0]?.url?.endsWith('/e2e.plugin'));

		await seedApprovedAddon(database.web, owner.userId, manifest('e2e.plugin'));
		await waitFor(() => posted().length > 0, NOTIFY_WITHIN_MS);
		await Bun.sleep(100);

		expect(posted()).toHaveLength(1);

		await database.web.db
			.update(schema.addon)
			.set({ delistedAt: new Date() })
			.where(eq(schema.addon.id, 'e2e.plugin'));
		await waitFor(() => posted().length === 0, NOTIFY_WITHIN_MS);
	});

	test('a staff note posts one audit embed', async () => {
		const moderator = await signUp(database.web, 'moderator');
		const before = auditLog.messages.length;

		await createStaffNote(database.web, moderator.caller, {
			subject: { type: 'addon', id: 'e2e.plugin' },
			body: 'Delisted for a broken build.',
		});
		await waitFor(() => auditLog.messages.length > before, NOTIFY_WITHIN_MS);
		await Bun.sleep(100);

		const notes = auditLog.messages.filter(
			(message) => message.embeds[0]?.description === 'Delisted for a broken build.',
		);

		expect(notes).toHaveLength(1);
	});

	test('a loader release is announced once, and a republish does not announce it again', async () => {
		const release = {
			platform: 'ios' as const,
			version: '9.9.9',
			versionKey: '9.9.9',
			url: 'https://example.com/unbound.ipa',
			publishedAt: new Date(),
		};

		await database.web.db.insert(schema.loaderRelease).values(release);
		await waitFor(() => channels.messages('21').length === 1, NOTIFY_WITHIN_MS);
		await database.web.db
			.insert(schema.loaderRelease)
			.values({ ...release, url: 'https://example.com/unbound-2.ipa' })
			.onConflictDoUpdate({
				target: [schema.loaderRelease.platform, schema.loaderRelease.version],
				set: { url: 'https://example.com/unbound-2.ipa' },
			});
		await Bun.sleep(300);

		expect(channels.messages('21').map((message) => message.embeds[0]?.title)).toEqual([
			'Unbound for iOS 9.9.9',
		]);
	});

	test('linking Discord to a sponsor grants the Sponsor role', async () => {
		const { internalAdapter } = await database.web.auth.$context;
		const user = { id: 'e2e-sponsor', name: 'Sponsor', email: 'e2e-sponsor@example.com' };

		await database.web.db.insert(schema.user).values(user);

		await linkGitHub(database.web, user.id, 'token');
		await seedSponsorship(database.web, { githubId: user.id });
		await internalAdapter.linkAccount({
			userId: user.id,
			providerId: 'discord',
			accountId: LINKED_DISCORD_ID,
		});
		await waitFor(() => guild.added.length > 0, NOTIFY_WITHIN_MS);

		expect(guild.added).toEqual([{ discordId: LINKED_DISCORD_ID, roleId: 'r-s' }]);
	});
});
