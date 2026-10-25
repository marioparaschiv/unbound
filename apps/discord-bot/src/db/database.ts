import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import type { EmptyRelations } from 'drizzle-orm/relations';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * @description Opens the bot's Postgres database over a postgres.js client.
 * @param url The connection string, `DATABASE_URL`.
 * @returns The Drizzle database, with the postgres.js client (which also serves `LISTEN`) on `$client`.
 */
export function createDatabase(url: string) {
	const client = postgres(url, { onnotice: () => void 0 });

	return drizzle({ client });
}

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = PostgresJsTransaction<EmptyRelations>;

export default { createDatabase };
