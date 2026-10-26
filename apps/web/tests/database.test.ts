import { afterAll, describe, expect, test } from 'bun:test';
import { eq, sql } from 'drizzle-orm';

import {
	addon,
	addonMaintainer,
	botFeedChange,
	moderationEvent,
	rateLimit,
	user,
} from '~/db/schema';
import type { Transaction } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';
import { ApiError } from '~/lib/api/errors';

import { createTestDatabase } from './helpers/database';
import { createTestContext } from './helpers/context';

const { ctx, close } = await createTestContext();

afterAll(close);

type Gate = {
	promise: Promise<void>;
	open: () => void;
};

function gate(): Gate {
	const { promise, resolve } = Promise.withResolvers<void>();

	return { promise, open: () => resolve() };
}

async function waitForLockWaiters(count: number) {
	for (let i = 0; i < 250; i++) {
		const [row] = await ctx.db.$client<{ waiting: number }[]>`
			select count(*)::int as waiting from pg_locks where locktype = 'advisory' and not granted`;

		if (row?.waiting === count) return;

		await Bun.sleep(20);
	}

	throw new Error(`Expected ${count} transaction(s) waiting on the ordered-id lock.`);
}

async function seedUser(id: string) {
	await ctx.db.insert(user).values({ id, name: id, email: `${id}@example.com` });
}

async function eventIds() {
	const rows = await ctx.db
		.select({ id: moderationEvent.id })
		.from(moderationEvent)
		.orderBy(moderationEvent.id);

	return rows.map((row) => row.id);
}

function insertEvent(tx: Transaction, subjectId: string) {
	return tx
		.insert(moderationEvent)
		.values({
			subjectType: 'user',
			subjectId,
			actorId: null,
			kind: 'user.unbanned',
			data: {},
			createdAt: new Date(),
		})
		.returning({ id: moderationEvent.id });
}

describe('migrateDatabase', () => {
	test('creates every Better Auth table', async () => {
		const rows = await ctx.db.$client<{ name: string }[]>`
			select table_name as name from information_schema.tables where table_schema = 'public'`;

		expect(rows.map((row) => row.name)).toEqual(
			expect.arrayContaining([
				'user',
				'session',
				'account',
				'verification',
				'device_code',
				'apikey',
				'rate_limit',
			]),
		);
	});

	test('installs pg_trgm for admin search', async () => {
		const rows = await ctx.db.$client`select 1 from pg_extension where extname = 'pg_trgm'`;

		expect(rows).toHaveLength(1);
	});

	test('refuses a database whose locale does not compare bytewise', async () => {
		const database = await createTestDatabase('en_US.UTF-8');

		try {
			await expect(migrateDatabase(database.url)).rejects.toThrow(/not libc C/);
		} finally {
			await database.drop();
		}
	});
});

describe('createDatabase', () => {
	test('enforces foreign keys', async () => {
		await expect(
			ctx.db.$client`insert into session (id, expires_at, token, updated_at, user_id)
				values ('s', now(), 't', now(), 'missing')`,
		).rejects.toThrow(/foreign key/);
	});

	test('retries a transaction that lost a serialization race, losing no update', async () => {
		await ctx.db.insert(rateLimit).values({ id: 'r', key: 'race', count: 0, lastRequest: 0 });

		const bothRead = gate();
		let waiting = 2;
		let attempts = 0;

		async function increment(tx: Transaction) {
			attempts++;

			const first = attempts <= 2;
			const [row] = await tx
				.select({ count: rateLimit.count })
				.from(rateLimit)
				.where(eq(rateLimit.key, 'race'));

			if (first) {
				waiting--;

				if (waiting === 0) {
					bothRead.open();
				}

				await bothRead.promise;
			}

			await tx
				.update(rateLimit)
				.set({ count: (row?.count ?? 0) + 1 })
				.where(eq(rateLimit.key, 'race'));
		}

		await Promise.all([ctx.db.transaction(increment), ctx.db.transaction(increment)]);

		const [row] = await ctx.db.select().from(rateLimit).where(eq(rateLimit.key, 'race'));

		expect(row?.count).toBe(2);
		expect(attempts).toBe(3);
	});

	test('does not retry a transaction that failed with an ApiError', async () => {
		let attempts = 0;

		await expect(
			ctx.db.transaction(async () => {
				attempts++;

				throw new ApiError('not_found', 'Nothing here.');
			}),
		).rejects.toThrow(ApiError);
		expect(attempts).toBe(1);
	});
});

describe('ordered ids', () => {
	test('moderation event ids are drawn in commit order', async () => {
		const before = await eventIds();
		const holdFirst = gate();
		const firstInserted = gate();
		let first = 0;
		let second = 0;

		const firstTx = ctx.db.transaction(async (tx) => {
			const [row] = await insertEvent(tx, 'first');

			first = row?.id ?? 0;
			firstInserted.open();
			await holdFirst.promise;
		});

		await firstInserted.promise;

		const secondTx = ctx.db.transaction(async (tx) => {
			const [row] = await insertEvent(tx, 'second');

			second = row?.id ?? 0;
		});

		await waitForLockWaiters(1);
		expect(await eventIds()).toEqual(before);

		holdFirst.open();
		await firstTx;
		await secondTx;

		expect(second).toBeGreaterThan(first);
		expect(await eventIds()).toEqual([...before, first, second]);
	});

	test('bot feed seqs are drawn in commit order', async () => {
		await seedUser('feed-a');
		await seedUser('feed-b');
		await ctx.db.insert(addon).values({
			id: 'ordered',
			type: 'plugin',
			name: 'Ordered',
			description: '',
			updatedAt: new Date(),
		});

		const holdFirst = gate();
		const firstInserted = gate();

		const firstTx = ctx.db.transaction(async (tx) => {
			await tx
				.insert(addonMaintainer)
				.values({ addonId: 'ordered', userId: 'feed-a', role: 'owner' });
			firstInserted.open();
			await holdFirst.promise;
		});

		await firstInserted.promise;

		const secondTx = ctx.db.transaction(async (tx) => {
			await tx
				.insert(addonMaintainer)
				.values({ addonId: 'ordered', userId: 'feed-b', role: 'maintainer' });
		});

		await waitForLockWaiters(1);

		const visible = await ctx.db
			.select({ key: botFeedChange.key })
			.from(botFeedChange)
			.where(sql`${botFeedChange.key} in ('feed-a', 'feed-b')`);

		expect(visible).toEqual([]);

		holdFirst.open();
		await firstTx;
		await secondTx;

		const rows = await ctx.db
			.select({ key: botFeedChange.key })
			.from(botFeedChange)
			.where(eq(botFeedChange.feed, 'members'))
			.orderBy(botFeedChange.seq);

		expect(rows.map((row) => row.key)).toEqual(['feed-a', 'feed-b']);
	});
});
