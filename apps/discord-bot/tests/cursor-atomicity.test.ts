import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { feedCursor, member } from '~/db/schema';
import { pollFeed } from '~/runtime/poller';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	type TestDatabase,
} from './helpers/database';
import { fakeFetcher, MEMBER } from './helpers/feeds';

// Postgres rejects NUL in text, which makes a write fail inside the page's transaction.
const NUL = '\u0000';

function outcome(promise: Promise<number>) {
	return promise.then(
		() => 'resolved',
		() => 'rejected',
	);
}

describe.skipIf(!DATABASE_URL)('feed cursor atomicity', () => {
	let database: TestDatabase;

	beforeAll(async () => {
		database = await createTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	async function state() {
		const { db } = database;
		const [cursor] = await db.select().from(feedCursor).where(eq(feedCursor.feed, 'members'));
		const members = await db
			.select({ userId: member.userId })
			.from(member)
			.orderBy(member.userId);

		return { cursor: cursor?.cursor ?? null, members: members.map((row) => row.userId) };
	}

	test('a good page commits its rows and its cursor, then the next poll resumes from it', async () => {
		const { fetchPage, calls } = fakeFetcher({
			members: [{ items: [MEMBER], cursor: 'c1', hasMore: false }],
		});

		await pollFeed(database.db, 'members', fetchPage, 100);
		await pollFeed(database.db, 'members', fetchPage, 100);

		expect(await state()).toEqual({ cursor: 'c1', members: ['user-1'] });
		expect(calls.get('members')).toEqual([null, 'c1']);
	});

	test('a page whose cursor write fails leaves its rows unwritten', async () => {
		const { fetchPage } = fakeFetcher({
			members: [
				{ items: [{ ...MEMBER, userId: 'user-2' }], cursor: `c2${NUL}`, hasMore: false },
			],
		});

		expect(await outcome(pollFeed(database.db, 'members', fetchPage, 100))).toBe('rejected');
		expect(await state()).toEqual({ cursor: 'c1', members: ['user-1'] });
	});

	test('a page whose ingest fails midway leaves rows and cursor unchanged, earlier pages stay committed', async () => {
		const { fetchPage } = fakeFetcher({
			members: [
				{ items: [{ ...MEMBER, userId: 'user-3' }], cursor: 'c3', hasMore: true },
				{
					items: [
						{ ...MEMBER, userId: 'user-4' },
						{ ...MEMBER, userId: 'user-5', githubLogin: `bad${NUL}` },
					],
					cursor: 'c4',
					hasMore: false,
				},
			],
		});

		expect(await outcome(pollFeed(database.db, 'members', fetchPage, 100))).toBe('rejected');
		expect(await state()).toEqual({ cursor: 'c3', members: ['user-1', 'user-3'] });
	});
});
