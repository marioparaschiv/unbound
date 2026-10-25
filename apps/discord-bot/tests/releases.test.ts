import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';

import { announceRelease, reconcileReleases, type ReleaseTarget } from '~/dispatchers/releases';
import type { ReleaseFeedItem } from '~/lib/feed/types';
import { createDatabase } from '~/db/database';
import { loaderRelease } from '~/db/schema';
import { feeds } from '~/lib/feed/feeds';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	type TestDatabase,
} from './helpers/database';
import { createFakeDiscord, type FakeDiscord } from './helpers/fake-discord';
import { RELEASE } from './helpers/feeds';

const TARGET: ReleaseTarget = { channelId: '21', roleId: '31' };
const NOW = Date.parse('2026-10-02T00:00:00.000Z');

const ANDROID: ReleaseFeedItem = {
	platform: 'android',
	version: '1.2.4',
	url: 'https://example.com/unbound.apk',
	changelog: null,
	publishedAt: '2026-09-30T00:00:00.000Z',
};

describe.skipIf(!DATABASE_URL)('loader release announcements', () => {
	let database: TestDatabase;
	let discord: FakeDiscord;

	beforeAll(async () => {
		database = await createTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	beforeEach(async () => {
		await database.db.execute(sql`TRUNCATE loader_release`);
		discord = createFakeDiscord();
	});

	afterEach(async () => {
		await discord.stop();
	});

	async function ingest(...items: ReleaseFeedItem[]) {
		await database.db.transaction((tx) => feeds.releases.ingest(tx, items));
	}

	function handle(item: ReleaseFeedItem) {
		return announceRelease(
			database.db,
			discord.rest,
			`${item.platform}:${item.version}`,
			TARGET,
			NOW,
		);
	}

	function reconcile() {
		return reconcileReleases(database.db, discord.rest, discord.selfId, TARGET, NOW);
	}

	async function rowOf(item: ReleaseFeedItem) {
		const [row] = await database.db
			.select()
			.from(loaderRelease)
			.where(
				and(
					eq(loaderRelease.platform, item.platform),
					eq(loaderRelease.version, item.version),
				),
			);

		return row;
	}

	function posts() {
		return discord.requests.filter((request) => request.method === 'POST');
	}

	test('a release is announced once, pinging only the releases role', async () => {
		await ingest(RELEASE);
		await handle(RELEASE);

		const [message, ...extra] = discord.messages('21');

		expect(extra).toHaveLength(0);
		expect(message?.content).toContain('<@&31>');
		expect(message?.allowed_mentions).toEqual({ parse: [], roles: ['31'] });
		expect(message?.embeds).toEqual([
			{
				title: 'Unbound for iOS 1.2.3',
				url: RELEASE.url,
				description: 'Fixes.',
				color: 0xc8_41_51,
				timestamp: RELEASE.publishedAt,
			},
		]);
		expect(await rowOf(RELEASE)).toMatchObject({ channelId: '21', messageId: message?.id });

		await handle(RELEASE);
		await reconcile();
		expect(posts()).toHaveLength(1);

		discord.handDelete('21', message?.id ?? '');
		await reconcile();
		expect(posts()).toHaveLength(1);
		expect(discord.messages('21')).toHaveLength(0);
	});

	test('reconcile announces every unannounced release in publish order', async () => {
		await ingest(RELEASE, ANDROID);
		await reconcile();

		const titles = discord.messages('21').map((message) => message.embeds[0]?.title);

		expect(titles).toEqual(['Unbound for Android 1.2.4', 'Unbound for iOS 1.2.3']);
		expect(discord.messages('21')[0]?.embeds[0]?.description).toBeUndefined();
		expect((await rowOf(ANDROID))?.messageId).toBe(discord.messages('21')[0]?.id);

		// The two ids straddle the fake's id length change; a string compare would delete the newer one.
		await reconcile();
		expect(discord.requests.map((request) => request.method)).not.toContain('DELETE');
		expect(discord.messages('21')).toHaveLength(2);
	});

	test('a release published over a week ago is never announced; a fresh one is', async () => {
		const old = { ...ANDROID, version: '0.9.0', publishedAt: '2026-09-24T00:00:00.000Z' };

		await ingest(old, RELEASE);
		await handle(old);
		await reconcile();

		const titles = discord.messages('21').map((message) => message.embeds[0]?.title);

		expect(titles).toEqual(['Unbound for iOS 1.2.3']);
		expect((await rowOf(old))?.messageId).toBeNull();
	});

	test('a release Discord rejects is logged and skipped, and the next reconcile announces it', async () => {
		await ingest(RELEASE, ANDROID);
		discord.rejectPost = (body) => body.embeds?.[0]?.url === ANDROID.url;
		await reconcile();

		expect((await rowOf(RELEASE))?.messageId).not.toBeNull();
		expect((await rowOf(ANDROID))?.messageId).toBeNull();

		discord.rejectPost = undefined;
		await reconcile();

		expect((await rowOf(ANDROID))?.messageId).not.toBeNull();
		expect(discord.messages('21')).toHaveLength(2);
	});

	test('reconcile never deletes a message in the releases channel', async () => {
		await ingest(RELEASE);
		await handle(RELEASE);

		const [announced] = discord.messages('21');

		discord.seed('21', discord.selfId, { embeds: announced?.embeds ?? [] });
		discord.seed('21', discord.selfId, { embeds: [{ url: 'https://gone' }] });
		discord.seed('21', '42', { content: 'when android' });

		await reconcile();

		expect(discord.messages('21')).toHaveLength(4);
		expect(discord.requests.map((request) => request.method)).not.toContain('DELETE');
		expect(posts()).toHaveLength(1);
		expect(await rowOf(RELEASE)).toMatchObject({ messageId: announced?.id });
	});

	test('reconcile keeps an old bot message that names no release', async () => {
		const old = discord.seed('21', discord.selfId, { embeds: [{ url: 'https://old-bot' }] });

		await ingest(RELEASE);
		await reconcile();

		expect(discord.messages('21').map((message) => message.id)).toContain(old);
		expect(posts()).toHaveLength(1);
	});

	test('a post retried after a timeout pings the role once', async () => {
		await discord.stop();
		discord = createFakeDiscord({ retries: 1, timeout: 100 });
		discord.beforePostResponse = async () => {
			discord.beforePostResponse = undefined;
			await Bun.sleep(300);
		};

		await ingest(RELEASE);
		await handle(RELEASE);

		const [message, ...extra] = discord.messages('21');

		expect(posts()).toHaveLength(2);
		expect(extra).toHaveLength(0);
		expect(await rowOf(RELEASE)).toMatchObject({ messageId: message?.id });
	});

	// The fake Discord's POST handler ends the announcer's own database client before it responds,
	// so the real post lands and the id write after it fails.
	async function crashAnnounce(item: ReleaseFeedItem) {
		const crashing = createDatabase(database.url);

		discord.beforePostResponse = () => crashing.$client.end();

		const outcome = await announceRelease(
			crashing,
			discord.rest,
			`${item.platform}:${item.version}`,
			TARGET,
			NOW,
		).then(
			() => 'announced',
			() => 'failed',
		);

		discord.beforePostResponse = undefined;

		return outcome;
	}

	test('announcements that lost their id writes are adopted by release, not by a shared url', async () => {
		const next = { ...ANDROID, version: '1.2.5', publishedAt: '2026-09-30T12:00:00.000Z' };

		await ingest(ANDROID, next);

		expect(await crashAnnounce(ANDROID)).toBe('failed');
		expect(await crashAnnounce(next)).toBe('failed');

		await reconcile();

		const titles = discord.messages('21').map((message) => message.embeds[0]?.title);
		const [first, second] = discord.messages('21');

		expect(titles).toEqual(['Unbound for Android 1.2.4', 'Unbound for Android 1.2.5']);
		expect(posts()).toHaveLength(2);
		expect((await rowOf(ANDROID))?.messageId).toBe(first?.id);
		expect((await rowOf(next))?.messageId).toBe(second?.id);
	});

	test('a crash between the post and the id write converges on reconcile', async () => {
		await ingest(RELEASE);

		expect(await crashAnnounce(RELEASE)).toBe('failed');
		expect(discord.messages('21')).toHaveLength(1);
		expect((await rowOf(RELEASE))?.messageId).toBeNull();

		await reconcile();

		const [message, ...extra] = discord.messages('21');

		expect(extra).toHaveLength(0);
		expect(posts()).toHaveLength(1);
		expect(await rowOf(RELEASE)).toMatchObject({ channelId: '21', messageId: message?.id });
	});
});
