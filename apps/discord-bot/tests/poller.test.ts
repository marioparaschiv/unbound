import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';

import { pollAll, pollFeed, startPoller } from '~/runtime/poller';
import { auditEvent, loaderRelease, member } from '~/db/schema';
import type { FetchFeedPage } from '~/lib/feed/client';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	type TestDatabase,
} from './helpers/database';
import { fakeFetcher, SAMPLE_PAGES } from './helpers/feeds';

function logged(spy: ReturnType<typeof spyOn>) {
	return spy.mock.calls.flat().map(String).join('\n');
}

describe.skipIf(!DATABASE_URL)('poller', () => {
	let database: TestDatabase;
	const warn = spyOn(console, 'warn');
	const error = spyOn(console, 'error');

	beforeAll(async () => {
		database = await createTestDatabase();
	});

	afterEach(() => {
		warn.mockClear();
		error.mockClear();
	});

	afterAll(async () => {
		warn.mockRestore();
		error.mockRestore();
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	test('a feed that reports more pages without advancing its cursor stops the round and warns', async () => {
		const { fetchPage, calls } = fakeFetcher({
			members: [
				{ items: [], cursor: 'stuck', hasMore: true },
				{ items: [], cursor: 'stuck', hasMore: true },
				{ items: [], cursor: 'stuck', hasMore: true },
			],
		});

		expect(await pollFeed(database.db, 'members', fetchPage, 100)).toBe(0);
		expect(calls.get('members')).toEqual([null, 'stuck']);
		expect(logged(warn)).toContain('Feed members reported more pages without advancing');
	});

	test('pollAll ingests the other feeds when one feed throws', async () => {
		const { fetchPage: serve } = fakeFetcher({
			events: [SAMPLE_PAGES.events],
			releases: [SAMPLE_PAGES.releases],
			members: [SAMPLE_PAGES.members],
		});
		const fetchPage: FetchFeedPage = async (feed, after, limit) => {
			if (feed === 'addons') {
				throw new Error('addons feed returned 500');
			}

			return serve(feed, after, limit);
		};

		await pollAll({ db: database.db, fetchPage, pageSize: 100, intervalMs: 1000 });

		expect(await database.db.select().from(auditEvent)).toHaveLength(1);
		expect(await database.db.select().from(loaderRelease)).toHaveLength(1);
		expect(await database.db.select().from(member)).toHaveLength(1);
		expect(logged(error)).toContain('Failed to poll feed addons');
	});

	test('stopping the poller waits for the round in flight', async () => {
		const gate = Promise.withResolvers<void>();
		const fetchPage: FetchFeedPage = async () => {
			await gate.promise;

			return { items: [], cursor: null, hasMore: false };
		};
		const stop = startPoller({ db: database.db, fetchPage, pageSize: 100, intervalMs: 1000 });
		let stopped = false;

		void stop().then(() => {
			stopped = true;
		});
		await Bun.sleep(50);
		expect(stopped).toBe(false);

		gate.resolve();
		await stop();
		expect(stopped).toBe(true);
	});
});
