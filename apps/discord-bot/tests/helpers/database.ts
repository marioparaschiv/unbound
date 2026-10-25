import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import postgres from 'postgres';

import { createDatabase, type Database } from '~/db/database';
import type { NotifyChannel } from '~/dispatchers/types';
import { migrateDatabase } from '~/db/migrate';

export type TestDatabase = {
	name: string;
	url: string;
	db: Database;
	drop: () => Promise<void>;
};

export type Notification = { channel: string; payload: string };

export type NotificationLog = {
	received: Notification[];
	/** Resolves once every notification committed before the call has arrived. */
	flush: () => Promise<void>;
	stop: () => Promise<void>;
};

const NOTIFY_CHANNELS: NotifyChannel[] = [
	'addon_changed',
	'audit_event',
	'loader_release',
	'member_changed',
];
const FLUSH_CHANNEL = 'test_flush';
// 42501: another role's backend is connected; 55006: a backend did not leave within Postgres's 5 s wait.
const RETRYABLE_DROP_CODES = new Set(['42501', '55006']);
const DROP_TIMEOUT_MS = 30_000;

/** Pass to `afterAll` so a drop that waits out a TimescaleDB scheduler is not cut off. */
export const DROP_HOOK_TIMEOUT_MS = DROP_TIMEOUT_MS + 10_000;

function readDatabaseUrl(): string | undefined {
	if (process.env.DATABASE_URL) {
		return process.env.DATABASE_URL;
	}

	const path = join(import.meta.dirname, '..', '..', '.env');

	if (!existsSync(path)) return;

	const line = readFileSync(path, 'utf8')
		.split('\n')
		.find((entry) => entry.startsWith('DATABASE_URL='));

	return (
		line
			?.slice('DATABASE_URL='.length)
			.trim()
			.replaceAll(/^["']|["']$/g, '') || undefined
	);
}

export const DATABASE_URL = readDatabaseUrl();

function withDatabase(url: string, name: string) {
	const parsed = new URL(url);

	parsed.pathname = `/${name}`;

	return parsed.toString();
}

async function onMaintenance(statement: string) {
	if (!DATABASE_URL) {
		throw new Error('DATABASE_URL is not set.');
	}

	const sql = postgres(withDatabase(DATABASE_URL, 'postgres'), {
		max: 1,
		onnotice: () => void 0,
	});

	try {
		await sql.unsafe(statement);
	} finally {
		await sql.end();
	}
}

function isRetryableDrop(error: unknown): error is postgres.PostgresError {
	return error instanceof postgres.PostgresError && RETRYABLE_DROP_CODES.has(error.code);
}

// TimescaleDB's launcher briefly opens a superuser scheduler in every new database, which a
// non-superuser cannot force out, so the drop retries until it has left.
async function dropDatabase(name: string) {
	const deadline = Date.now() + DROP_TIMEOUT_MS;

	while (true) {
		try {
			await onMaintenance(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);

			return;
		} catch (error) {
			if (!isRetryableDrop(error) || Date.now() > deadline) {
				throw error;
			}

			await Bun.sleep(200);
		}
	}
}

/**
 * @description Creates and migrates a throwaway `unbound_bot_test_<random>` database on the local cluster.
 * @returns The database, its URL, and `drop()` which force-drops it.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
	if (!DATABASE_URL) {
		throw new Error('DATABASE_URL is not set.');
	}

	const name = `unbound_bot_test_${randomBytes(6).toString('hex')}`;

	await onMaintenance(`CREATE DATABASE ${name}`);

	const url = withDatabase(DATABASE_URL, name);
	const db = createDatabase(url);

	await migrateDatabase(db);

	return {
		name,
		url,
		db,
		async drop() {
			await db.$client.end();
			await dropDatabase(name);
		},
	};
}

/**
 * @description Records every notification on the bot's channels from a dedicated connection.
 * @param database The test database to listen on.
 * @returns The received notifications, a `flush()` barrier and `stop()`.
 */
export async function recordNotifications(database: TestDatabase): Promise<NotificationLog> {
	const sql = postgres(database.url, { max: 1, onnotice: () => void 0 });
	const received: Notification[] = [];
	const flushed = new Set<string>();

	for (const channel of NOTIFY_CHANNELS) {
		await sql.listen(channel, (payload) => {
			received.push({ channel, payload });
		});
	}

	await sql.listen(FLUSH_CHANNEL, (payload) => {
		flushed.add(payload);
	});

	return {
		received,
		// Postgres delivers notifications in commit order, so the barrier arrives after all earlier ones.
		async flush() {
			const token = randomBytes(6).toString('hex');

			await database.db.$client`SELECT pg_notify(${FLUSH_CHANNEL}, ${token})`;
			await waitFor(() => flushed.has(token));
		},
		async stop() {
			await sql.end();
		},
	};
}

/**
 * @description Polls a condition until it holds.
 * @param condition The condition to wait for.
 * @param timeoutMs How long to wait before failing.
 * @returns Resolves once the condition holds; rejects on timeout.
 */
export async function waitFor(condition: () => boolean, timeoutMs: number = 10_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error(`Condition not met within ${timeoutMs}ms.`);
		}

		await Bun.sleep(20);
	}
}
