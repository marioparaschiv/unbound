import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Release } from '@unbound-app/web/bot';
import { schema } from '@unbound-app/web/testing';
import { and, eq, sql } from 'drizzle-orm';

import { announceRelease, reconcileReleases, type ReleaseTarget } from '~/dispatchers/releases';
import { createDatabase, type Database } from '~/db/database';
import { releasePost } from '~/db/schema';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from './helpers/database';
import { createFakeDiscord, embedLength, type FakeDiscord } from './helpers/fake-discord-rest';
import { createFakeReads, RELEASE, type FakeReads } from './helpers/fake-reads';

const TARGET: ReleaseTarget = { channelId: '21', roleId: '31' };
const NOW = Date.parse('2026-10-02T00:00:00.000Z');

const ANDROID: Release = {
	platform: 'android',
	version: '1.2.4',
	url: 'https://example.com/unbound.apk',
	changelog: null,
	publishedAt: new Date('2026-09-30T00:00:00.000Z'),
};

describe.skipIf(!DATABASE_URL)('loader release announcements', () => {
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
		await database.db.execute(sql`TRUNCATE bot.release_post`);
		discord = createFakeDiscord();
		fake = createFakeReads();
	});

	afterEach(async () => {
		await discord.stop();
	});

	function stores(db: Database = database.db) {
		return { db, web: fake.reads };
	}

	function ingest(...items: Release[]) {
		fake.releases.push(...items);
	}

	function handle(item: Release) {
		return announceRelease(
			stores(),
			discord.rest,
			`${item.platform}:${item.version}`,
			TARGET,
			NOW,
		);
	}

	function reconcile() {
		return reconcileReleases(stores(), discord.rest, discord.selfId, TARGET, NOW);
	}

	async function rowOf(item: Release) {
		const [row] = await database.db
			.select()
			.from(releasePost)
			.where(
				and(eq(releasePost.platform, item.platform), eq(releasePost.version, item.version)),
			);

		return row;
	}

	function posts() {
		return discord.requests.filter((request) => request.method === 'POST');
	}

	test('a release is announced once, pinging only the releases role', async () => {
		ingest(RELEASE);
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
				timestamp: RELEASE.publishedAt.toISOString(),
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

	test('a release with a very long changelog posts within the embed size cap', async () => {
		const long = { ...RELEASE, changelog: 'c'.repeat(10_000) };

		ingest(long);
		await handle(long);

		const [embed] = discord.messages('21')[0]?.embeds ?? [];

		expect(embed).toBeDefined();
		expect(embedLength(embed ?? {})).toBeLessThanOrEqual(6000);
	});

	test('reconcile announces every unannounced release in publish order', async () => {
		ingest(RELEASE, ANDROID);
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
		const old = {
			...ANDROID,
			version: '0.9.0',
			publishedAt: new Date('2026-09-24T00:00:00.000Z'),
		};

		ingest(old, RELEASE);
		await handle(old);
		await reconcile();

		const titles = discord.messages('21').map((message) => message.embeds[0]?.title);

		expect(titles).toEqual(['Unbound for iOS 1.2.3']);
		expect((await rowOf(old))?.messageId).toBeUndefined();
	});

	test('a release Discord rejects is logged and skipped, and the next reconcile announces it', async () => {
		ingest(RELEASE, ANDROID);
		discord.rejectPost = (body) => body.embeds?.[0]?.url === ANDROID.url;
		await reconcile();

		expect((await rowOf(RELEASE))?.messageId).toBeDefined();
		expect((await rowOf(ANDROID))?.messageId).toBeUndefined();

		discord.rejectPost = undefined;
		await reconcile();

		expect((await rowOf(ANDROID))?.messageId).toBeDefined();
		expect(discord.messages('21')).toHaveLength(2);
	});

	test('reconcile never deletes a message in the releases channel', async () => {
		ingest(RELEASE);
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

		ingest(RELEASE);
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

		ingest(RELEASE);
		await handle(RELEASE);

		const [message, ...extra] = discord.messages('21');

		expect(posts()).toHaveLength(2);
		expect(extra).toHaveLength(0);
		expect(await rowOf(RELEASE)).toMatchObject({ messageId: message?.id });
	});

	// The fake Discord's POST handler ends the announcer's own database client before it responds,
	// so the real post lands and the id write after it fails.
	async function crashAnnounce(item: Release) {
		const crashing = createDatabase(database.url);

		discord.beforePostResponse = () => crashing.$client.end();

		const outcome = await announceRelease(
			stores(crashing),
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
		const next = {
			...ANDROID,
			version: '1.2.5',
			publishedAt: new Date('2026-09-30T12:00:00.000Z'),
		};

		ingest(ANDROID, next);

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
		ingest(RELEASE);

		expect(await crashAnnounce(RELEASE)).toBe('failed');
		expect(discord.messages('21')).toHaveLength(1);
		expect((await rowOf(RELEASE))?.messageId).toBeUndefined();

		await reconcile();

		const [message, ...extra] = discord.messages('21');

		expect(extra).toHaveLength(0);
		expect(posts()).toHaveLength(1);
		expect(await rowOf(RELEASE)).toMatchObject({ channelId: '21', messageId: message?.id });
	});

	test('a release published on the web is announced once; a withdrawn one never', async () => {
		const real = { db: database.db, web: database.reads };
		const publishedAt = new Date(NOW - 60_000);

		await database.web.db.insert(schema.loaderRelease).values([
			{ ...RELEASE, versionKey: RELEASE.version, publishedAt },
			{ ...ANDROID, versionKey: ANDROID.version, publishedAt },
		]);
		await database.web.db
			.delete(schema.loaderRelease)
			.where(eq(schema.loaderRelease.platform, 'android'));
		await announceRelease(real, discord.rest, 'ios:1.2.3', TARGET, NOW);
		await announceRelease(real, discord.rest, 'android:1.2.4', TARGET, NOW);
		await reconcileReleases(real, discord.rest, discord.selfId, TARGET, NOW);

		expect(discord.messages('21').map((message) => message.embeds[0]?.title)).toEqual([
			'Unbound for iOS 1.2.3',
		]);
		expect(posts()).toHaveLength(1);
	});
});
