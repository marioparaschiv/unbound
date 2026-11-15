import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';

import { createApiReleasesDispatcher, renderApiRelease } from '~/dispatchers/api-releases';
import { apiReleasePost } from '~/db/schema';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from '../helpers/database';
import { createFakeDiscord, type FakeDiscord } from '../helpers/fake-discord-rest';
import { createFakeReads } from '../helpers/fake-reads';

const NOW = Date.parse('2026-10-02T00:00:00.000Z');
const MANIFEST_URL = 'https://cdn.example/docs/api/versions.json';

describe('renderApiRelease', () => {
	test('links the GitHub release and stamps when the feed found it', () => {
		const body = renderApiRelease('3.6.0', new Date(NOW));

		expect(body.embeds).toEqual([
			{
				title: '@unbound-app/api 3.6.0',
				url: 'https://github.com/marioparaschiv/unbound/releases/tag/api-v3.6.0',
				color: 0xc8_41_51,
				footer: { text: 'API' },
				timestamp: new Date(NOW).toISOString(),
			},
		]);
	});
});

describe.skipIf(!DATABASE_URL)('API release announcements', () => {
	let database: BotTestDatabase;
	let discord: FakeDiscord;
	let manifest: string | undefined;
	let requested: string[];

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	beforeEach(async () => {
		await database.db.execute(sql`TRUNCATE bot.api_release_post`);
		discord = createFakeDiscord();
		manifest = undefined;
		requested = [];
	});

	afterEach(async () => {
		await discord.stop();
	});

	function list(...versions: string[]) {
		manifest = JSON.stringify({ package: 'api', versions: ['main', ...versions] });
	}

	function reconcile() {
		const dispatcher = createApiReleasesDispatcher({
			channelId: '23',
			cdnUrl: 'https://cdn.example',
			messages: discord.gateway,
			now: () => NOW,
			fetch: async (url) => {
				requested.push(url);

				return new Response(manifest ?? '', { status: manifest ? 200 : 404 });
			},
		});

		return dispatcher.reconcile({ db: database.db, web: createFakeReads().reads });
	}

	function titles() {
		return discord.messages('23').map((message) => message.embeds[0]?.title);
	}

	test('the first run posts none of the listed versions; each later one posts once, oldest first', async () => {
		list('v3.5.1', 'v3.5.0');
		await reconcile();

		expect(requested).toEqual([MANIFEST_URL]);
		expect(titles()).toEqual([]);
		expect(await database.db.select().from(apiReleasePost)).toHaveLength(2);

		list('v3.7.0', 'v3.6.0', 'v3.5.1', 'v3.5.0');
		await reconcile();
		await reconcile();

		expect(titles()).toEqual(['@unbound-app/api 3.6.0', '@unbound-app/api 3.7.0']);
	});

	test('no docs yet still lays the floor, so the first listed version posts', async () => {
		await reconcile();
		list('v1.0.0');
		await reconcile();

		expect(titles()).toEqual(['@unbound-app/api 1.0.0']);
	});
});
