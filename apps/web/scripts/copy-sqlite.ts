/**
 * Copies the app's SQLite database into Postgres: `bun run db:copy-sqlite <sqlite-path> [--replace]`
 * in `apps/web`, with `DATABASE_DIRECT_URL` set. Refuses a target with rows unless `--replace`.
 */
import { createLogger } from '@unbound-app/logger';
import { parseArgs } from 'node:util';
import postgres from 'postgres';

import { envSchema } from '~/lib/env';

import type { TableReport } from './copy-sqlite/copy';

import { copySqlite, VerificationError } from './copy-sqlite/copy';

const logger = createLogger('Web', 'Copy');

function print(reports: TableReport[]) {
	for (const report of reports) {
		const { table, present, rows, checksum, targetRows, targetChecksum, match } = report;
		const note = present ? '' : ' (absent in source)';

		process.stdout.write(
			`${table.padEnd(26)} ${String(rows).padStart(7)}  ${checksum}  ${String(targetRows).padStart(7)}  ${targetChecksum}  ${match ? 'match' : 'MISMATCH'}${note}\n`,
		);
	}
}

// Postgres's detail can name a key's value, as the row key of a source error does, never a whole row.
function printLocation(error: InstanceType<typeof postgres.PostgresError>) {
	const location = [
		error.table_name ? `table ${error.table_name}` : '',
		error.column_name ? `column ${error.column_name}` : '',
	].filter(Boolean);

	for (const line of [error.detail, location.join(', ')]) {
		if (line) {
			logger.error(line);
		}
	}
}

const { positionals, values } = parseArgs({
	args: Bun.argv.slice(2),
	options: { replace: { type: 'boolean', default: false } },
	allowPositionals: true,
});
const [sqlitePath] = positionals;

if (!sqlitePath || positionals.length > 1) {
	logger.error('Usage: bun run db:copy-sqlite <sqlite-path> [--replace]');
	process.exit(2);
}

const targetUrl = envSchema.shape.DATABASE_DIRECT_URL.parse(process.env.DATABASE_DIRECT_URL);
const started = performance.now();

try {
	const reports = await copySqlite({ sqlitePath, targetUrl, replace: values.replace });

	print(reports);
	logger.success(
		`Copied ${reports.length} tables into ${new URL(targetUrl).pathname.slice(1)} in ${Math.round(performance.now() - started)} ms.`,
	);
} catch (error) {
	if (error instanceof VerificationError) {
		print(error.reports);
	}

	logger.error(error instanceof Error ? error.message : error);

	if (error instanceof Error && error.cause instanceof Error) {
		logger.error(error.cause.message);
	}

	if (error instanceof postgres.PostgresError) {
		printLocation(error);
	}

	process.exitCode = 1;
}
