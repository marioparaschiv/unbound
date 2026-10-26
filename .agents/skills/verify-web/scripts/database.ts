// Usage: bun database.ts create|drop|exists|env <instance> [env file] | sweep <state root>
// Never prints a URL; `env` prints PG* variables, password included, for `eval` only.
import { appendFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { SQL } from 'bun';

import {
	MAINTENANCE_URL,
	dropDatabase,
	withDatabase,
} from '../../../../apps/web/tests/helpers/database';

type DatabaseRow = {
	datname: string;
};

const PREFIX = 'unbound_web_verify_';

const [command, instance, envFile] = process.argv.slice(2);

if (!instance || (command !== 'sweep' && !/^[a-z0-9-]+$/.test(instance))) {
	throw new Error('Pass the instance name, matching [a-z0-9-]+ (or the state root to sweep).');
}

if (!MAINTENANCE_URL) {
	throw new Error('No Postgres URL: set DATABASE_DIRECT_URL in apps/web/.env.');
}

const name = `${PREFIX}${instance.replaceAll('-', '_')}`;
const sql = new SQL(withDatabase(MAINTENANCE_URL, 'postgres'), { max: 1 });

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function hasSession(session: string): boolean {
	return spawnSync('tmux', ['has-session', '-t', `=${session}`]).status === 0;
}

try {
	switch (command) {
		case 'create': {
			if (!envFile) {
				throw new Error('Pass the env file to append DATABASE_URL to.');
			}

			// A crashed run can leave the database behind; a relaunch starts from an empty one.
			await dropDatabase(name);
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

			await dropDatabase(name);

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

		case 'env': {
			const url = new URL(withDatabase(MAINTENANCE_URL, name));
			const variables = {
				PGHOST: url.hostname,
				PGPORT: url.port || '5432',
				PGUSER: decodeURIComponent(url.username),
				PGPASSWORD: decodeURIComponent(url.password),
				PGDATABASE: name,
			};

			for (const [key, value] of Object.entries(variables)) {
				console.log(`export ${key}=${shellQuote(value)}`);
			}

			break;
		}

		// An instance whose state dir and tmux session are both gone was never torn down.
		case 'sweep': {
			const rows: DatabaseRow[] = await sql`
				SELECT datname FROM pg_database WHERE datname LIKE ${`${PREFIX}%`}
			`;

			for (const { datname } of rows) {
				const owner = datname.slice(PREFIX.length).replaceAll('_', '-');

				if (existsSync(join(instance, owner)) || hasSession(`verify-web-${owner}`)) {
					continue;
				}

				await dropDatabase(datname);
				console.log(`dropped leftover database ${datname}`);
			}

			break;
		}

		default:
			throw new Error('The command must be create, drop, exists, env or sweep.');
	}
} finally {
	await sql.close();
}
