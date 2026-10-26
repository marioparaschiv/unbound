import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';

import { listen, type Backoff } from '~/runtime/listen';

import {
	createBotTestDatabase,
	DATABASE_URL,
	waitFor,
	type BotTestDatabase,
} from './helpers/database';
import { createTcpProxy } from './helpers/proxy';

const FAST_BACKOFF: Backoff = { initialMs: 50, maxMs: 1000 };
const OUTAGE_MS = 6500;

function recorder() {
	const payloads: string[] = [];
	const counts = { reconciles: 0 };

	return {
		payloads,
		counts,
		handler: async (payload: string) => void payloads.push(payload),
		reconcile: async () => void counts.reconciles++,
	};
}

describe.skipIf(!DATABASE_URL)('listen', () => {
	let database: BotTestDatabase;

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	function withApplicationName(name: string) {
		const url = new URL(database.url);

		url.searchParams.set('application_name', name);

		return url.toString();
	}

	async function backends(applicationName: string) {
		const rows = await database.db.$client`
			SELECT pid FROM pg_stat_activity WHERE application_name = ${applicationName}
		`;

		return rows.length;
	}

	test('reconciles again after a terminated backend, keeps receiving, and unlisten closes it', async () => {
		const applicationName = `bot_listen_test_${randomBytes(4).toString('hex')}`;
		const seen = recorder();
		const unlisten = listen({
			url: withApplicationName(applicationName),
			channel: 'addon_changed',
			handler: seen.handler,
			reconcile: seen.reconcile,
			backoff: FAST_BACKOFF,
		});

		try {
			await waitFor(() => seen.counts.reconciles === 1);

			const terminated = await database.db.$client`
				SELECT pg_terminate_backend(pid) AS ok FROM pg_stat_activity WHERE application_name = ${applicationName}
			`;

			expect(terminated.map((row) => row.ok)).toEqual([true]);

			await waitFor(() => seen.counts.reconciles === 2);
			await database.db.$client`SELECT pg_notify('addon_changed', 'after-reconnect')`;
			await waitFor(() => seen.payloads.includes('after-reconnect'));

			expect(seen.counts.reconciles).toBe(2);
			expect(seen.payloads).toEqual(['after-reconnect']);
		} finally {
			await unlisten();
		}

		await waitFor(async () => (await backends(applicationName)) === 0);
	});

	test(
		'recovers from an outage longer than postgres.js gives up after, then reconciles and receives',
		async () => {
			const proxy = createTcpProxy(database.url);
			const seen = recorder();
			const unlisten = listen({
				url: proxy.url,
				channel: 'loader_release',
				handler: seen.handler,
				reconcile: seen.reconcile,
				backoff: FAST_BACKOFF,
			});

			try {
				await waitFor(() => seen.counts.reconciles === 1);
				proxy.down();
				await Bun.sleep(OUTAGE_MS);
				await database.db.$client`SELECT pg_notify('loader_release', 'during-outage')`;
				proxy.up();
				await waitFor(() => seen.counts.reconciles === 2);
				await database.db.$client`SELECT pg_notify('loader_release', 'after-outage')`;
				await waitFor(() => seen.payloads.includes('after-outage'));

				expect(seen.payloads).toEqual(['after-outage']);
			} finally {
				await unlisten();
				proxy.down();
			}
		},
		OUTAGE_MS + 15_000,
	);

	test('a failing reconcile is retried until it succeeds', async () => {
		let attempts = 0;
		const unlisten = listen({
			url: database.url,
			channel: 'member_changed',
			handler: async () => void 0,
			async reconcile() {
				attempts++;

				if (attempts <= 2) {
					throw new Error(`Discord returned 503 on attempt ${attempts}`);
				}
			},
			backoff: FAST_BACKOFF,
		});

		try {
			await waitFor(() => attempts === 3);
			await Bun.sleep(FAST_BACKOFF.maxMs);

			expect(attempts).toBe(3);
		} finally {
			await unlisten();
		}
	});

	test('a throwing handler is logged and the listener keeps running', async () => {
		const seen = recorder();
		const unlisten = listen({
			url: database.url,
			channel: 'audit_event',
			async handler(payload) {
				await seen.handler(payload);

				if (payload === 'boom') {
					throw new Error('handler failed');
				}
			},
			reconcile: seen.reconcile,
			backoff: FAST_BACKOFF,
		});

		try {
			await waitFor(() => seen.counts.reconciles === 1);
			await database.db.$client`SELECT pg_notify('audit_event', 'boom')`;
			await database.db.$client`SELECT pg_notify('audit_event', 'fine')`;
			await waitFor(() => seen.payloads.length === 2);

			expect(seen.payloads).toEqual(['boom', 'fine']);
		} finally {
			await unlisten();
		}
	});

	test('unlisten stops the retries while the database is unreachable', async () => {
		const proxy = createTcpProxy(database.url);

		proxy.down();

		const unlisten = listen({
			url: proxy.url,
			channel: 'addon_changed',
			handler: async () => void 0,
			reconcile: async () => void 0,
			backoff: { initialMs: 60_000, maxMs: 60_000 },
		});

		await Bun.sleep(200);

		const started = Date.now();

		await unlisten();

		expect(Date.now() - started).toBeLessThan(1000);
	});
});
