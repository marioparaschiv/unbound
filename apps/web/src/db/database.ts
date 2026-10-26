import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import relations from '~/db/relations';

// Serialization failures and deadlocks are the two errors a re-run on a fresh snapshot can fix.
const RETRYABLE_CODES = new Set(['40001', '40P01']);
const MAX_ATTEMPTS = 10;
const BASE_DELAY_MS = 5;
const MAX_DELAY_MS = 200;

function open(client: postgres.Sql) {
	return drizzle({ client, relations });
}

type Drizzle = ReturnType<typeof open>;

export type Transaction = Parameters<Parameters<Drizzle['transaction']>[0]>[0];

/** A transaction body. It may run more than once, so it does database work through `tx` only. */
export type TransactionBody<T> = (tx: Transaction) => Promise<T>;

/** The app's database, whose only transaction is serializable and retried. */
export type Database = Omit<Drizzle, 'transaction'> & {
	transaction<T>(body: TransactionBody<T>): Promise<T>;
};

/**
 * @description Opens the app's Postgres pool over postgres.js. Prepared statements are off for
 * pgbouncer's transaction mode, and every transaction is serializable.
 * @param url The connection string, `DATABASE_URL`.
 * @returns The database, with the postgres.js client on `$client`.
 */
export function createDatabase(url: string): Database {
	const client = postgres(url, { prepare: false, onnotice: () => void 0 });
	const db = open(client);
	const begin = db.transaction.bind(db);

	function transaction<T>(body: TransactionBody<T>): Promise<T> {
		return retrySerializable(() => begin(body, { isolationLevel: 'serializable' }));
	}

	return Object.assign(db, { transaction });
}

// True for a serialization failure or a deadlock, which a re-run on a fresh snapshot can fix.
// UNKNOWN: whatever a transaction threw; drizzle wraps a failed statement's error in `cause`.
function isRetryable(error: unknown): boolean {
	const cause =
		error instanceof Error && error.cause instanceof postgres.PostgresError
			? error.cause
			: error;

	return cause instanceof postgres.PostgresError && RETRYABLE_CODES.has(cause.code);
}

async function retrySerializable<T>(run: () => Promise<T>): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await run();
		} catch (error) {
			if (!isRetryable(error) || attempt >= MAX_ATTEMPTS) {
				throw error;
			}

			await Bun.sleep(Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt) * Math.random());
		}
	}
}

export default { createDatabase };
