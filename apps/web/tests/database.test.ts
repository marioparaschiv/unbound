import { afterAll, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';

import { moderationEvent, rateLimit } from '~/db/schema';
import type { Transaction } from '~/db/database';
import { MIGRATIONS_FOLDER, migrateDatabase } from '~/db/migrate';
import { ApiError } from '~/lib/api/errors';

import { createTestDatabase } from './helpers/database';
import { createTestContext } from './helpers/context';

const { ctx, close } = await createTestContext();

afterAll(close);

// The last migration of the bot feed era; the ones after it drop the feed.
const FEED_MIGRATION = '20261026021602_bot-feed';

type Gate = {
	promise: Promise<void>;
	open: () => void;
};

// UNKNOWN: whatever the promise rejects with.
async function failure(promise: PromiseLike<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
}

function gate(): Gate {
	const { promise, resolve } = Promise.withResolvers<void>();

	return { promise, open: () => resolve() };
}

async function waitForLockWaiters(count: number) {
	for (let i = 0; i < 250; i++) {
		// Only this database's waiters on the ordering key (7695970, 1); other test files share the cluster.
		const [row] = await ctx.db.$client<{ waiting: number }[]>`
			select count(*)::int as waiting from pg_locks
			where locktype = 'advisory' and not granted
				and database = (select oid from pg_database where datname = current_database())
				and classid = 7695970 and objid = 1 and objsubid = 2`;

		if (row?.waiting === count) return;

		await Bun.sleep(20);
	}

	throw new Error(`Expected ${count} transaction(s) waiting on the ordered-id lock.`);
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

	test('leaves no bot feed table, sequence, function or trigger behind', async () => {
		const rows = await ctx.db.$client<{ name: string }[]>`
			select relname as name from pg_class where relname like 'bot_feed%'
			union all select proname from pg_proc where proname like 'bot_feed%'
			union all select tgname from pg_trigger where tgname like 'bot_feed%'`;

		expect([...rows]).toEqual([]);
	});

	test('an upgrade revokes the bot feed key and keeps its user as an ordinary one', async () => {
		const database = await createTestDatabase();
		const before = await mkdtemp(join(tmpdir(), 'unbound-migrations-'));
		const client = postgres(database.url, { max: 1, onnotice: () => void 0 });

		try {
			for (const name of await readdir(MIGRATIONS_FOLDER)) {
				if (name <= FEED_MIGRATION) {
					await cp(join(MIGRATIONS_FOLDER, name), join(before, name), {
						recursive: true,
					});
				}
			}

			await migrate(drizzle({ client }), { migrationsFolder: before });
			await client`insert into "user" (id, name, email, role) values
				('bot', 'Unbound Bot', 'bot@unbound.invalid', 'bot'),
				('ci', 'CI', 'ci@example.com', 'ci')`;
			await client`insert into apikey (id, reference_id, key, created_at, updated_at) values
				('bot-key', 'bot', 'hashed-bot', now(), now()),
				('ci-key', 'ci', 'hashed-ci', now(), now())`;
			await migrateDatabase(database.url);

			expect([...(await client`select id, role from "user" order by id`)]).toEqual([
				{ id: 'bot', role: 'user' },
				{ id: 'ci', role: 'ci' },
			]);
			expect([...(await client`select id from apikey`)]).toEqual([{ id: 'ci-key' }]);
		} finally {
			await client.end();
			await rm(before, { recursive: true, force: true });
			await database.drop();
		}
	});

	test('refuses a database whose locale does not compare bytewise', async () => {
		const database = await createTestDatabase('en_US.UTF-8');

		try {
			expect(String(await failure(migrateDatabase(database.url)))).toMatch(/not libc C/);
		} finally {
			await database.drop();
		}
	});
});

describe('createTestContext', () => {
	async function databaseExists(name: string): Promise<boolean> {
		const rows = await ctx.db.$client`select 1 from pg_database where datname = ${name}`;

		return rows.length > 0;
	}

	// A drop can outlast drop()'s own wait while other files' drops queue on a busy cluster.
	test('drops its database when it fails to start', async () => {
		const created: string[] = [];

		async function openDatabase() {
			const database = await createTestDatabase();

			created.push(database.name);

			return database;
		}

		expect(
			await failure(createTestContext({ ADDON_LIST_PAGE_SIZE: 'many' }, openDatabase)),
		).toBeDefined();

		const [name = ''] = created;
		let exists = true;

		for (let i = 0; i < 100 && exists; i++) {
			exists = await databaseExists(name);

			if (exists) {
				await Bun.sleep(200);
			}
		}

		expect({ created: created.length, exists }).toEqual({ created: 1, exists: false });
	}, 30_000);
});

describe('createDatabase', () => {
	test('enforces foreign keys', async () => {
		const insert = ctx.db
			.$client`insert into session (id, expires_at, token, updated_at, user_id)
			values ('s', now(), 't', now(), 'missing')`;

		expect(String(await failure(insert))).toMatch(/foreign key/);
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

		expect(
			await failure(
				ctx.db.transaction(async () => {
					attempts++;

					throw new ApiError('not_found', 'Nothing here.');
				}),
			),
		).toBeInstanceOf(ApiError);
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
});
