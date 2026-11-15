import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { asc } from 'drizzle-orm';

import { tag } from '~/db/schema';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from '../helpers/database';

describe.skipIf(!DATABASE_URL)("Carl-bot's tags", () => {
	let database: BotTestDatabase;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	test('the migrations bring every tag Carl-bot answered, each within a message', async () => {
		const tags = await database.db.select().from(tag).orderBy(asc(tag.name));

		expect(tags.map(({ name }) => name)).toEqual([
			'addons',
			'enmity',
			'fakenitro',
			'freenitro',
			'installplugin',
			'ntts',
			'reds',
			'redsapp',
			'rosiecord',
			'screenshare',
			'unbound',
			'vc',
		]);
		expect(tags.every(({ content }) => content.length > 0 && content.length <= 2000)).toBe(
			true,
		);
	});
});
