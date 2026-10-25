import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Client } from 'discord.js';

import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import { startDispatchers } from '~/runtime/start';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	waitFor,
	type TestDatabase,
} from './helpers/database';

type Calls = {
	handles: number;
	reconciles: number;
	active: number;
	maxActive: number;
};

type FakeDispatcher = {
	dispatcher: Dispatcher;
	calls: Calls;
	posted: string[];
};

type FakeOptions = {
	failFirstHandle?: boolean;
	handleMs?: number;
};

describe.skipIf(!DATABASE_URL)('timed reconcile', () => {
	let database: TestDatabase;
	let context: DispatcherContext;

	beforeAll(async () => {
		database = await createTestDatabase();
		await database.db.$client`
			CREATE TABLE timed_post (id text PRIMARY KEY, posted boolean NOT NULL DEFAULT false)
		`;
		// The fake dispatchers never touch Discord, so an unready client is enough.
		context = { db: database.db, client: new Client({ intents: [] }) as Client<true> };
	});

	afterAll(async () => {
		await context.client.destroy();
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	function fakeDispatcher({
		failFirstHandle = false,
		handleMs = 0,
	}: FakeOptions): FakeDispatcher {
		const calls: Calls = { handles: 0, reconciles: 0, active: 0, maxActive: 0 };
		const posted: string[] = [];

		async function tracked(run: () => Promise<void>) {
			calls.active++;
			calls.maxActive = Math.max(calls.maxActive, calls.active);

			try {
				await run();
			} finally {
				calls.active--;
			}
		}

		return {
			calls,
			posted,
			dispatcher: {
				name: 'fake',
				channel: 'addon_changed',
				reconcile: () =>
					tracked(async () => {
						calls.reconciles++;

						const rows = await database.db.$client`
							UPDATE timed_post SET posted = true WHERE NOT posted RETURNING id
						`;

						posted.push(...rows.map((row) => String(row.id)));
					}),
				handle: () =>
					tracked(async () => {
						calls.handles++;
						await Bun.sleep(handleMs);

						if (failFirstHandle && calls.handles === 1) {
							throw new Error('Discord returned 503');
						}
					}),
			},
		};
	}

	test('a row whose handle failed is posted on the next timer tick without a new NOTIFY', async () => {
		const fake = fakeDispatcher({ failFirstHandle: true });
		const stop = startDispatchers([fake.dispatcher], context, database.url, 300);

		try {
			await waitFor(() => fake.calls.reconciles === 1);
			await database.db.$client`
				WITH inserted AS (INSERT INTO timed_post (id) VALUES ('row-1') RETURNING id)
				SELECT pg_notify('addon_changed', id) FROM inserted
			`;
			await waitFor(() => fake.calls.handles === 1);

			expect(fake.posted).toEqual([]);

			await waitFor(() => fake.posted.length > 0, 2000);

			expect(fake.posted).toEqual(['row-1']);
			expect(fake.calls.handles).toBe(1);
		} finally {
			await stop();
		}
	});

	test('timer reconciles never overlap a running handle', async () => {
		const fake = fakeDispatcher({ handleMs: 40 });
		const stop = startDispatchers([fake.dispatcher], context, database.url, 10);

		try {
			await waitFor(() => fake.calls.reconciles > 0);

			for (let i = 0; i < 5; i++) {
				await database.db.$client`SELECT pg_notify('addon_changed', ${String(i)})`;
			}

			await waitFor(() => fake.calls.handles === 5);
			const before = fake.calls.reconciles;

			await waitFor(() => fake.calls.reconciles > before);

			expect(fake.calls.maxActive).toBe(1);
		} finally {
			await stop();
		}
	});

	test('stop clears the timer, so nothing runs once it resolves', async () => {
		const fake = fakeDispatcher({});
		const stop = startDispatchers([fake.dispatcher], context, database.url, 10);

		await waitFor(() => fake.calls.reconciles >= 3);
		await stop();

		const after = fake.calls.reconciles;

		await Bun.sleep(100);

		expect(fake.calls.reconciles).toBe(after);
		expect(fake.calls.active).toBe(0);
	});
});
