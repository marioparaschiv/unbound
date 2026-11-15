import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Bundle } from '@unbound-app/web/bot';
import { sql } from 'drizzle-orm';

import { createBundlesDispatcher, renderBundle } from '~/dispatchers/bundles';
import { bundlePost } from '~/db/schema';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from '../helpers/database';
import { createFakeDiscord, type FakeDiscord } from '../helpers/fake-discord-rest';
import { BUNDLE, createFakeReads, type FakeReads } from '../helpers/fake-reads';

const NOW = Date.parse('2026-10-02T00:00:00.000Z');
const NEXT: Bundle = {
	channel: 'beta',
	version: 'c0ffee0000000000000000000000000000000000',
	previousVersion: BUNDLE.version,
	publishedAt: new Date('2026-10-01T12:00:00.000Z'),
};

describe('renderBundle', () => {
	test('links the commits since the previous bundle and shows the commit subject', () => {
		const body = renderBundle(BUNDLE, 'fix(loader): name what to install (#1552)');

		expect(body.embeds).toEqual([
			{
				title: 'Beta bundle `b6bf35e`',
				url: 'https://github.com/marioparaschiv/unbound/compare/a813a50...b6bf35e',
				color: 0xc8_41_51,
				footer: { text: 'fix(loader): name what to install (#1552)' },
				timestamp: BUNDLE.publishedAt.toISOString(),
			},
		]);
		expect(body.allowed_mentions).toEqual({ parse: [] });
	});

	test("a channel's first bundle links its commit, and a missing subject names the channel", () => {
		const body = renderBundle({ ...BUNDLE, previousVersion: null });

		expect(body.embeds?.[0]?.url).toBe(
			`https://github.com/marioparaschiv/unbound/commit/${BUNDLE.version}`,
		);
		expect(body.embeds?.[0]?.footer).toEqual({ text: 'Beta bundle' });
	});
});

describe.skipIf(!DATABASE_URL)('bundle announcements', () => {
	let database: BotTestDatabase;
	let discord: FakeDiscord;
	let fake: FakeReads;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	beforeEach(async () => {
		await database.db.execute(sql`TRUNCATE bot.bundle_post`);
		discord = createFakeDiscord();
		fake = createFakeReads();
	});

	afterEach(async () => {
		await discord.stop();
	});

	function bundles() {
		return createBundlesDispatcher({
			channelId: '22',
			messages: discord.gateway,
			commits: async (sha) => (sha === NEXT.version ? 'feat(client): next' : undefined),
			now: () => NOW,
		});
	}

	function stores() {
		return { db: database.db, web: fake.reads };
	}

	test('the first run posts none of the bundles already out; a later bundle posts once', async () => {
		fake.bundles.push(BUNDLE);
		await bundles().handle(`beta:${BUNDLE.version}`, stores());
		await bundles().reconcile(stores());

		expect(discord.messages('22')).toHaveLength(0);
		expect(await database.db.select().from(bundlePost)).toEqual([
			expect.objectContaining({ version: BUNDLE.version, messageId: null }),
		]);

		fake.bundles.push(NEXT);
		await bundles().handle(`beta:${NEXT.version}`, stores());
		await bundles().reconcile(stores());

		const [message, ...extra] = discord.messages('22');

		expect(extra).toHaveLength(0);
		expect(message?.embeds[0]?.title).toBe('Beta bundle `c0ffee0`');
		expect(message?.embeds[0]?.footer?.text).toBe('feat(client): next');
	});

	test('a first run with no fresh bundle still lays the floor, so the next bundle posts', async () => {
		await bundles().reconcile(stores());
		fake.bundles.push(NEXT);
		await bundles().reconcile(stores());

		expect(discord.messages('22')).toHaveLength(1);
	});

	test('a bundle older than a week is never announced', async () => {
		await bundles().reconcile(stores());
		fake.bundles.push({ ...NEXT, publishedAt: new Date('2026-09-20T00:00:00.000Z') });
		await bundles().reconcile(stores());

		expect(discord.messages('22')).toHaveLength(0);
	});
});
