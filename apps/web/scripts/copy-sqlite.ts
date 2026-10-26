/**
 * Copies the app's SQLite database into Postgres: `bun run db:copy-sqlite <sqlite-path> [--replace]`
 * in `apps/web`, with `DATABASE_DIRECT_URL` set. Refuses a target with rows unless `--replace`.
 */
import { createLogger } from '@unbound-app/logger';
import { parseArgs } from 'node:util';

import { envSchema } from '~/lib/env';

import type { TableReport } from './copy-sqlite/copy';

import { copySqlite, VerificationError } from './copy-sqlite/copy';

const logger = createLogger('Web', 'Copy');

function print(reports: TableReport[]) {
	for (const { table, present, rows, checksum, match } of reports) {
		const note = present ? '' : ' (absent in source)';

		process.stdout.write(
			`${table.padEnd(26)} ${String(rows).padStart(7)}  ${checksum}  ${match ? 'match' : 'MISMATCH'}${note}\n`,
		);
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

	process.exitCode = 1;
}
