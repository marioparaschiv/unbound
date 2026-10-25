import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { addon, auditEvent, feedCursor, loaderRelease, member } from '~/db/schema';
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
import { fakeFetcher, SAMPLE_PAGES } from './helpers/feeds';

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
});
