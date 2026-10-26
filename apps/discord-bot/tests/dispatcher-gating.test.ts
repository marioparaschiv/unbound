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
import { Client } from 'discord.js';

import type { Dispatcher, DispatcherContext, NotifyChannel } from '~/dispatchers/types';
import { DISCORD_IDS, GUILD_ID, type IdConstantName } from '~/lib/constants';
import { startDispatchers, type DiscordIds } from '~/runtime/start';
import { checkConfig } from '~/lib/config';

import {
	createBotTestDatabase,
	DATABASE_URL,
	waitFor,
	type BotTestDatabase,
} from './helpers/database';

type FakeDispatcher = {
	dispatcher: Dispatcher;
	calls: number;
};

type Warn = ReturnType<typeof spyOn<Console, 'warn'>>;

const ENV = {
	DISCORD_TOKEN: 'token',
	DATABASE_URL: 'postgres://bot@localhost:6432/bot',
	DATABASE_DIRECT_URL: 'postgres://bot@localhost:5432/bot',
};

function fakeDispatcher(
	name: string,
	channel: NotifyChannel,
	requires: IdConstantName[],
): FakeDispatcher {
	const fake: FakeDispatcher = {
		calls: 0,
		dispatcher: {
			name,
			channel,
			requires,
			async reconcile() {
				fake.calls++;
			},
			async handle() {
				fake.calls++;
			},
		},
	};

	return fake;
}

describe.skipIf(!DATABASE_URL)('dispatcher gating', () => {
	let database: BotTestDatabase;
	let context: DispatcherContext;
	let warn: Warn;

	beforeAll(async () => {
		database = await createBotTestDatabase();
		// The fake dispatchers never touch Discord, so an unready client is enough.
		context = {
			db: database.db,
			web: database.reads,
			client: new Client({ intents: [] }) as Client<true>,
		};
	});

	afterAll(async () => {
		await context.client.destroy();
		await database.drop();
	});

	// The logger writes warnings through console.warn, so that is where they are read back.
	beforeEach(() => {
		warn = spyOn(console, 'warn').mockImplementation(() => void 0);
	});

	afterEach(() => {
		warn.mockRestore();
	});

	function warnings() {
		return warn.mock.calls.map((args) => args.join(' '));
	}

	test('a dispatcher missing an id never runs and is named in one warning', async () => {
		const ids: DiscordIds = {
			...DISCORD_IDS,
			PLUGINS_CHANNEL_ID: '1',
			RELEASES_CHANNEL_ID: '0',
			RELEASES_ROLE_ID: '0',
		};
		const ready = fakeDispatcher('ready', 'addon_changed', ['PLUGINS_CHANNEL_ID']);
		const pending = fakeDispatcher('pending', 'member_changed', [
			'PLUGINS_CHANNEL_ID',
			'RELEASES_CHANNEL_ID',
			'RELEASES_ROLE_ID',
		]);
		const { started, stop } = startDispatchers(
			[ready.dispatcher, pending.dispatcher],
			context,
			database.url,
			10,
			ids,
		);

		try {
			await database.db.$client`SELECT pg_notify('member_changed', 'member-1')`;
			await waitFor(() => ready.calls >= 3);
		} finally {
			await stop();
		}

		expect(started).toEqual([ready.dispatcher]);
		expect(pending.calls).toBe(0);
		expect(warnings()).toHaveLength(1);
		expect(warnings()[0]).toContain(
			"Not starting pending: RELEASES_CHANNEL_ID, RELEASES_ROLE_ID are still '0' in src/lib/constants.ts.",
		);
	});

	test('boots with only role sync enabled under the real constants', async () => {
		expect(checkConfig(ENV, GUILD_ID).ok).toBe(true);

		const roles = fakeDispatcher('roles', 'member_changed', [
			'CONTRIBUTOR_ROLE_ID',
			'ADDON_DEVELOPER_ROLE_ID',
			'SPONSOR_ROLE_ID',
		]);
		const { started, stop } = startDispatchers([roles.dispatcher], context, database.url, 10);

		try {
			await waitFor(() => roles.calls > 0);
		} finally {
			await stop();
		}

		expect(started).toEqual([roles.dispatcher]);
		expect(warnings()).toEqual([]);
	});
});
