import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { addon, auditEvent, feedCursor, loaderRelease, member } from '~/db/schema';
import { createDatabase, POOLED_OPTIONS, type Database } from '~/db/database';
import { FEED_NAMES } from '~/lib/feed/feeds';
import { pollFeed } from '~/runtime/poller';
import { listen } from '~/runtime/listen';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	waitFor,
	type TestDatabase,
} from './helpers/database';
import { startPgbouncer, PGBOUNCER, type Pgbouncer } from './helpers/pgbouncer';
import { ADDON, fakeFetcher, SAMPLE_PAGES } from './helpers/feeds';

// Fewer server connections than client connections, so statements move between them.
const POOL_SIZE = 2;
const REPLAYS = 5;

describe.skipIf(!DATABASE_URL || !PGBOUNCER)('pooled database behind pgbouncer', () => {
	let database: TestDatabase;
	let bouncer: Pgbouncer;
	let pooled: Database;

	beforeAll(async () => {
		database = await createTestDatabase();
		bouncer = await startPgbouncer(database.url, POOL_SIZE);
		pooled = createDatabase(bouncer.url, POOLED_OPTIONS);
	});

	afterAll(async () => {
		await pooled.$client.end();
		await bouncer.stop();
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	async function counts() {
		const { db } = database;

		return {
			addons: (await db.select().from(addon)).length,
			events: (await db.select().from(auditEvent)).length,
			releases: (await db.select().from(loaderRelease)).length,
			members: (await db.select().from(member)).length,
			cursors: (await db.select().from(feedCursor)).map((row) => row.cursor).toSorted(),
		};
	}

	async function pollEveryFeed() {
		const { fetchPage } = fakeFetcher({
			addons: [SAMPLE_PAGES.addons],
			events: [SAMPLE_PAGES.events],
			releases: [SAMPLE_PAGES.releases],
			members: [SAMPLE_PAGES.members],
		});

		await Promise.all(FEED_NAMES.map((feed) => pollFeed(pooled, feed, fetchPage, 100)));
	}

	test('polls every feed at once through transaction pooling, and concurrent replays ingest nothing twice', async () => {
		const expected = {
			addons: 1,
			events: 1,
			releases: 1,
			members: 1,
			cursors: ['addons-1', 'events-1', 'members-1', 'releases-1'],
		};

		await pollEveryFeed();
		expect(await counts()).toEqual(expected);

		await Promise.all(Array.from({ length: REPLAYS }, pollEveryFeed));
		expect(await counts()).toEqual(expected);
	});

	test('a dispatcher listener on the direct url receives notifies from writes through pgbouncer', async () => {
		const payloads: string[] = [];
		const subscribed = Promise.withResolvers<void>();
		const unlisten = listen({
			url: database.url,
			channel: 'addon_changed',
			handler: async (payload) => void payloads.push(payload),
			reconcile: async () => subscribed.resolve(),
		});

		try {
			await subscribed.promise;
			await pooled.update(addon).set({ listed: false });
			await waitFor(() => payloads.includes(ADDON.id));
		} finally {
			await unlisten();
		}
	});
});
