import { appendFileSync } from 'node:fs';
import { SQL } from 'bun';

// Usage: bun database.ts create <instance> <env file> | drop <instance> | exists <instance>
// Manages the instance's throwaway `unbound_web_verify_<instance>` database on the cluster that
// apps/web/.env's DATABASE_DIRECT_URL names. Never prints a URL, so the password stays out of logs.
import { MAINTENANCE_URL, withDatabase } from '../../../../apps/web/tests/helpers/database';

type DatabaseRow = {
	datname: string;
};

const [command, instance, envFile] = process.argv.slice(2);

if (!instance || !/^[a-z0-9-]+$/.test(instance)) {
	throw new Error('Pass the instance name, matching [a-z0-9-]+.');
}

if (!MAINTENANCE_URL) {
	throw new Error('No Postgres URL: set DATABASE_DIRECT_URL in apps/web/.env.');
}

const name = `unbound_web_verify_${instance.replaceAll('-', '_')}`;
const sql = new SQL(withDatabase(MAINTENANCE_URL, 'postgres'), { max: 1 });

try {
	switch (command) {
		case 'create': {
			if (!envFile) {
				throw new Error('Pass the env file to append DATABASE_URL to.');
			}

			// A crashed run can leave the database behind; a relaunch starts from an empty one.
			await sql.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
			await sql.unsafe(
				`CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER libc LOCALE 'C'`,
			);

			const url = withDatabase(MAINTENANCE_URL, name);

			appendFileSync(envFile, `DATABASE_URL=${url}\nDATABASE_DIRECT_URL=${url}\n`);
			console.log(`created database ${name}`);
			break;
		}

		case 'drop': {
			const [existing]: DatabaseRow[] = await sql`
				SELECT datname FROM pg_database WHERE datname = ${name}
			`;

			await sql.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);

			if (existing) {
				console.log(`dropped database ${name}`);
			}

			break;
		}

		case 'exists': {
			const [existing]: DatabaseRow[] = await sql`
				SELECT datname FROM pg_database WHERE datname = ${name}
			`;

			console.log(name);
			process.exitCode = existing ? 0 : 1;
			break;
		}

		default:
			throw new Error('The command must be create, drop or exists.');
	}
} finally {
	await sql.close();
}
