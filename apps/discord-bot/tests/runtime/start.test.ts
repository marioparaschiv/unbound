import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { createRolesDispatcher } from '~/dispatchers/roles';
import type { Dispatcher } from '~/dispatchers/types';
import { startDispatchers } from '~/runtime/start';
import { roleGrant } from '~/db/schema';

import {
	createBotTestDatabase,
	DATABASE_URL,
	waitFor,
	type BotTestDatabase,
} from '../helpers/database';
import { FAKE_GUILD_ID, fakeDiscord } from '../helpers/roles-discord';
import { createFakeReads, MEMBER } from '../helpers/fake-reads';

describe.skipIf(!DATABASE_URL)('startDispatchers', () => {
	let database: BotTestDatabase;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	// The roles dispatcher keeps no lock of its own: only the runtime's queue keeps a reconcile and a
	// handle from both reading the member as ungranted and adding each role twice.
	test('concurrent role reconciles and handles add each role once', async () => {
		await database.db.delete(roleGrant);

		const fake = createFakeReads();
		const discord = fakeDiscord({ members: { [MEMBER.discordId]: [] } });
		const roles = createRolesDispatcher({
			guildId: FAKE_GUILD_ID,
			guilds: discord.guilds,
			contributors: { get: async () => new Set([MEMBER.githubId ?? '']) },
			ids: {
				CONTRIBUTOR_ROLE_ID: 'r-c',
				ADDON_DEVELOPER_ROLE_ID: 'r-a',
				SPONSOR_ROLE_ID: 'r-s',
			},
			now: Date.now,
		});
		let handled = 0;
		let reconciled = 0;
		const counted: Dispatcher = {
			...roles,
			async reconcile(context) {
				await roles.reconcile(context);
				reconciled++;
			},
			async handle(payload, context) {
				await roles.handle(payload, context);
				handled++;
			},
		};

		const { stop } = startDispatchers(
			[counted],
			{ db: database.db, web: fake.reads },
			database.url,
			5,
		);

		try {
			// The first reconcile runs once LISTEN is up and finds no member; the member then arrives
			// while timed reconciles and handles all race for it.
			await waitFor(() => reconciled > 0);
			fake.members.push({ ...MEMBER, isSponsor: true });

			for (let i = 0; i < 5; i++) {
				await database.db
					.$client`SELECT pg_notify('member_changed', ${`user:${MEMBER.userId}`})`;
			}

			await waitFor(() => handled === 5);
		} finally {
			await stop();
		}

		expect(discord.added.map((grant) => grant.roleId).toSorted()).toEqual([
			'r-a',
			'r-c',
			'r-s',
		]);
		expect(discord.fetched).toEqual([MEMBER.discordId]);
	});
});
