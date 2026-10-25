import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { addon, addonMessage, auditEvent, feedCursor, loaderRelease, member } from '~/db/schema';
import { FEED_NAMES } from '~/lib/feed/feeds';
import { pollFeed } from '~/runtime/poller';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	recordNotifications,
	type NotificationLog,
	type TestDatabase,
} from './helpers/database';
import { ADDON, EVENT, fakeFetcher, RELEASE, SAMPLE_PAGES } from './helpers/feeds';

describe.skipIf(!DATABASE_URL)('feed ingest', () => {
	let database: TestDatabase;
	let log: NotificationLog;

	beforeAll(async () => {
		database = await createTestDatabase();
		log = await recordNotifications(database);
	});

	afterAll(async () => {
		await log.stop();
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	async function snapshot() {
		const { db } = database;

		return {
			addons: await db.select().from(addon),
			events: await db.select().from(auditEvent),
			releases: await db.select().from(loaderRelease),
			members: await db.select().from(member),
			cursors: await db
				.select({ feed: feedCursor.feed, cursor: feedCursor.cursor })
				.from(feedCursor),
		};
	}

	test('replaying the same page of every feed changes nothing and notifies nothing', async () => {
		const pages = Object.fromEntries(
			FEED_NAMES.map((feed) => [feed, [SAMPLE_PAGES[feed], SAMPLE_PAGES[feed]]]),
		);
		const { fetchPage } = fakeFetcher(pages);

		for (const feed of FEED_NAMES) {
			expect(await pollFeed(database.db, feed, fetchPage, 100)).toBe(1);
		}

		await log.flush();

		const first = await snapshot();

		expect(log.received).toHaveLength(4);
		expect(first.addons).toHaveLength(1);
		expect(first.events).toHaveLength(1);
		expect(first.releases).toHaveLength(1);
		expect(first.members).toHaveLength(1);

		log.received.length = 0;

		for (const feed of FEED_NAMES) {
			await pollFeed(database.db, feed, fetchPage, 100);
		}

		await log.flush();

		expect(await snapshot()).toEqual(first);
		expect(log.received).toEqual([]);
	});

	test('replays and updates keep the posted message ids of events, releases and addons', async () => {
		const { db } = database;
		const event = { ...EVENT, id: 2 };
		const release = { ...RELEASE, version: '2.0.0' };
		const item = { ...ADDON, id: 'addon-posted' };
		const posted = { channelId: '10', messageId: '20' };

		await pollFeed(
			database.db,
			'events',
			fakeFetcher({ events: [{ items: [event], cursor: 'e2', hasMore: false }] }).fetchPage,
			100,
		);
		await pollFeed(
			database.db,
			'releases',
			fakeFetcher({ releases: [{ items: [release], cursor: 'r2', hasMore: false }] })
				.fetchPage,
			100,
		);
		await pollFeed(
			database.db,
			'addons',
			fakeFetcher({ addons: [{ items: [item], cursor: 'a2', hasMore: false }] }).fetchPage,
			100,
		);
		await db.update(auditEvent).set(posted).where(eq(auditEvent.id, event.id));
		await db
			.update(loaderRelease)
			.set(posted)
			.where(eq(loaderRelease.version, release.version));
		await db.insert(addonMessage).values({ addonId: item.id, ...posted, postedHash: 'posted' });

		const { fetchPage } = fakeFetcher({
			events: [{ items: [event], cursor: 'e3', hasMore: false }],
			releases: [
				{
					items: [{ ...release, url: 'https://example.com/unbound-2.ipa' }],
					cursor: 'r3',
					hasMore: false,
				},
			],
			addons: [{ items: [{ ...item, version: '2.0.0' }], cursor: 'a3', hasMore: false }],
		});

		await pollFeed(db, 'events', fetchPage, 100);
		await pollFeed(db, 'releases', fetchPage, 100);
		await pollFeed(db, 'addons', fetchPage, 100);

		const [storedEvent] = await db.select().from(auditEvent).where(eq(auditEvent.id, event.id));
		const [storedRelease] = await db
			.select()
			.from(loaderRelease)
			.where(eq(loaderRelease.version, release.version));
		const [storedAddon] = await db.select().from(addon).where(eq(addon.id, item.id));
		const messages = await db
			.select({ addonId: addonMessage.addonId, messageId: addonMessage.messageId })
			.from(addonMessage)
			.where(eq(addonMessage.addonId, item.id));

		expect(storedEvent).toMatchObject(posted);
		expect(storedRelease).toMatchObject({
			...posted,
			url: 'https://example.com/unbound-2.ipa',
		});
		expect(storedAddon?.data.version).toBe('2.0.0');
		expect(messages).toEqual([{ addonId: item.id, messageId: posted.messageId }]);
	});
});
