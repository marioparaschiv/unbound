import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

import { listen } from '~/runtime/listen';

import {
	createTestDatabase,
	DROP_HOOK_TIMEOUT_MS,
	DATABASE_URL,
	waitFor,
	type TestDatabase,
} from './helpers/database';

describe.skipIf(!DATABASE_URL)('listen', () => {
	let database: TestDatabase;

	beforeAll(async () => {
		database = await createTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	}, DROP_HOOK_TIMEOUT_MS);

	test('reconciles again after a dropped connection and keeps receiving notifications', async () => {
		const applicationName = `bot_listen_test_${randomBytes(4).toString('hex')}`;
		const sql = postgres(database.url, {
			connection: { application_name: applicationName },
			onnotice: () => void 0,
		});
		const payloads: string[] = [];
		let reconciles = 0;

		const unlisten = await listen(
			sql,
			'addon_changed',
			async (payload) => {
				payloads.push(payload);
			},
			async () => {
				reconciles++;
			},
		);

		try {
			await waitFor(() => reconciles === 1);

			const terminated = await database.db.$client`
				SELECT pg_terminate_backend(pid) AS ok FROM pg_stat_activity WHERE application_name = ${applicationName}
			`;

			expect(terminated.map((row) => row.ok)).toEqual([true]);

			await waitFor(() => reconciles === 2);
			await database.db.$client`SELECT pg_notify('addon_changed', 'after-reconnect')`;
			await waitFor(() => payloads.includes('after-reconnect'));

			expect(reconciles).toBe(2);
			expect(payloads).toEqual(['after-reconnect']);
		} finally {
			await unlisten();
			await sql.end();
		}
	});

	test('a throwing handler or reconcile is logged and the listener keeps running', async () => {
		const sql = postgres(database.url, { onnotice: () => void 0 });
		const payloads: string[] = [];

		const unlisten = await listen(
			sql,
			'audit_event',
			async (payload) => {
				payloads.push(payload);

				if (payload === 'boom') {
					throw new Error('handler failed');
				}
			},
			async () => {
				throw new Error('reconcile failed');
			},
		);

		try {
			await database.db.$client`SELECT pg_notify('audit_event', 'boom')`;
			await database.db.$client`SELECT pg_notify('audit_event', 'fine')`;
			await waitFor(() => payloads.length === 2);

			expect(payloads).toEqual(['boom', 'fine']);
		} finally {
			await unlisten();
			await sql.end();
		}
	});
});
