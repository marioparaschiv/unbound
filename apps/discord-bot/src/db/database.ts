import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import type { EmptyRelations } from 'drizzle-orm/relations';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type DatabaseOptions = Pick<postgres.Options<Record<string, never>>, 'prepare' | 'max'>;

// pgbouncer's transaction mode can run a statement on another server connection than its prepare.
// `max` is half the `unbound_bot` pool_size of 10, so an old and new process overlapping in a restart fit.
export const POOLED_OPTIONS: DatabaseOptions = { prepare: false, max: 5 };

/**
 * @description Opens the bot's Postgres database over a postgres.js client.
 * @param url The connection string: `DATABASE_URL` with `POOLED_OPTIONS`, or `DATABASE_DIRECT_URL`.
 * @param options Overrides for the postgres.js client, `POOLED_OPTIONS` behind pgbouncer.
 * @returns The Drizzle database, with the postgres.js client on `$client`.
 */
export function createDatabase(url: string, options: DatabaseOptions = {}) {
	const client = postgres(url, { ...options, onnotice: () => void 0 });

	return drizzle({ client });
}

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = PostgresJsTransaction<EmptyRelations>;

export default { POOLED_OPTIONS, createDatabase };
