import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { checkTriggers } from '~/db/triggers';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from './helpers/database';

describe.skipIf(!DATABASE_URL)('startup trigger check', () => {
	let database: BotTestDatabase;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	test('reports nothing after the migrations and names each trigger a web migration lost', async () => {
		expect(await checkTriggers(database.db)).toEqual([]);

		await database.db.$client`drop trigger bot_account on public.account`;
		await database.db.$client`drop trigger bot_loader_release on public.loader_release`;

		expect(await checkTriggers(database.db)).toEqual([
			{ name: 'bot_account', table: 'account' },
			{ name: 'bot_loader_release', table: 'loader_release' },
		]);
	});
});
