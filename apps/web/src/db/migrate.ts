import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { join } from 'node:path';
import postgres from 'postgres';

export const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', '..', 'drizzle');

type DatabaseLocale = {
	provider: string;
	collate: string;
	ctype: string;
};

/**
 * @description Applies every pending drizzle-kit migration from `apps/web/drizzle` over a connection of
 * its own, after checking the database compares text bytewise and folds ASCII case only.
 * @param url The direct (not pgbouncer) connection string, `DATABASE_DIRECT_URL`.
 * @returns Resolves once every migration is applied; rejects on any other locale.
 */
export async function migrateDatabase(url: string): Promise<void> {
	const client = postgres(url, { max: 1, onnotice: () => void 0 });

	try {
		await assertByteOrderLocale(client);
		await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
	} finally {
		await client.end();
	}
}

// `version_key` order, keyset paging and `ilike` all assume libc C: byte order, ASCII-only folding.
async function assertByteOrderLocale(client: postgres.Sql) {
	const [locale] = await client<DatabaseLocale[]>`
		select datlocprovider as provider, datcollate as collate, datctype as ctype
		from pg_database where datname = current_database()`;

	if (locale?.provider === 'c' && locale.collate === 'C' && locale.ctype === 'C') return;

	throw new Error(
		`The database's locale is ${JSON.stringify(locale)}, not libc C. Create it with ` +
			"CREATE DATABASE … TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER libc LOCALE 'C'.",
	);
}

export default { MIGRATIONS_FOLDER, migrateDatabase };
