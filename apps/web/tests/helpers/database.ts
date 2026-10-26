import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { Query } from 'drizzle-orm';
import { join } from 'node:path';
import postgres from 'postgres';

import type { Database } from '~/db/database';

export type TestDatabase = {
	name: string;
	/** The direct URL of the throwaway database. */
	url: string;
	drop: () => Promise<void>;
};

export type PlanNode = {
	'Node Type': string;
	'Index Name'?: string;
	'Relation Name'?: string;
	Alias?: string;
	'Index Cond'?: string;
	Filter?: string;
	Plans?: PlanNode[];
};

type ExplainRow = {
	'QUERY PLAN': [{ Plan: PlanNode }];
};

type DatabaseName = {
	datname: string;
};

const PREFIX = 'unbound_web_test_';
// 42501: another role's backend is connected; 55006: a backend did not leave within Postgres's 5 s wait.
const RETRYABLE_DROP_CODES = new Set(['42501', '55006']);
// A DROP DATABASE waits for every backend on the cluster to absorb a barrier, which a busy shared
// cluster can hold up for seconds. `drop()` waits this long, then lets the drop finish on its own, so
// a hook closing several contexts stays inside bun's 5 s timeout.
const DROP_WAIT_MS = 250;
const DROP_RETRY_DEADLINE_MS = 30_000;
// A test database this old was left behind by a crashed or timed-out run.
const STALE_AFTER_MS = 60 * 60 * 1000;

function readEnvFile(key: string): string | undefined {
	const path = join(import.meta.dirname, '..', '..', '.env');

	if (!existsSync(path)) return;

	const line = readFileSync(path, 'utf8')
		.split('\n')
		.find((entry) => entry.startsWith(`${key}=`));

	return (
		line
			?.slice(key.length + 1)
			.trim()
			.replaceAll(/^["']|["']$/g, '') || undefined
	);
}

/** The cluster test databases are created on: the direct URL, else CI's `DATABASE_URL`, else `.env`. */
export const MAINTENANCE_URL =
	process.env.DATABASE_DIRECT_URL ??
	process.env.DATABASE_URL ??
	readEnvFile('DATABASE_DIRECT_URL');

// CI provides Postgres, so a missing URL there is a misconfiguration, not a reason to skip.
if (process.env.CI && !MAINTENANCE_URL) {
	throw new Error('DATABASE_URL is not set; the web tests must not skip in CI.');
}

/**
 * @description Builds the URL of another database on the same cluster.
 * @param url Any URL on the cluster.
 * @param name The database name.
 * @returns The URL with its path replaced.
 */
export function withDatabase(url: string, name: string): string {
	const parsed = new URL(url);

	parsed.pathname = `/${name}`;

	return parsed.toString();
}

async function onMaintenance<T extends postgres.Row[] = postgres.Row[]>(statement: string) {
	if (!MAINTENANCE_URL) {
		throw new Error('No Postgres URL: set DATABASE_DIRECT_URL in apps/web/.env.');
	}

	const sql = postgres(withDatabase(MAINTENANCE_URL, 'postgres'), {
		max: 1,
		onnotice: () => void 0,
	});

	try {
		return await sql.unsafe<T>(statement);
	} finally {
		await sql.end();
	}
}

function isRetryableDrop(error: unknown): error is postgres.PostgresError {
	return error instanceof postgres.PostgresError && RETRYABLE_DROP_CODES.has(error.code);
}

async function dropDatabase(name: string) {
	const deadline = Date.now() + DROP_RETRY_DEADLINE_MS;

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

// A drop still running when the wait ends carries on in the background; if the run exits first, the
// next run's sweep drops the database.
async function dropWithin(name: string) {
	const dropped = dropDatabase(name).catch((error: unknown) => {
		console.warn(`Could not drop ${name}; the next run's sweep will:`, error);
	});

	await Promise.race([dropped, Bun.sleep(DROP_WAIT_MS)]);
}

let swept: Promise<void> | undefined;

async function sweepStale() {
	const rows = await onMaintenance<DatabaseName[]>(
		`SELECT datname FROM pg_database WHERE datname LIKE '${PREFIX}%'`,
	);
	const cutoff = Date.now() - STALE_AFTER_MS;

	for (const { datname } of rows) {
		const createdAt = Number(datname.slice(PREFIX.length).split('_')[0]);

		if (!(createdAt < cutoff)) {
			continue;
		}

		// Another run may be dropping it too.
		await dropDatabase(datname).catch(() => void 0);
	}
}

/**
 * @description Creates an empty `unbound_web_test_<ms>_<hex>` database with the libc C locale the
 * migration requires. Only generated names are created or dropped, so no real database is touched.
 * @param locale The database locale; anything but `C` is for testing the migration's locale guard.
 * @returns The database, its URL and `drop()`, which force-drops it.
 */
export async function createTestDatabase(locale: string = 'C'): Promise<TestDatabase> {
	swept ??= sweepStale();
	await swept;

	const name = `${PREFIX}${Date.now()}_${randomBytes(4).toString('hex')}`;

	await onMaintenance(
		`CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER libc LOCALE '${locale}'`,
	);

	return {
		name,
		url: withDatabase(MAINTENANCE_URL ?? '', name),
		drop: () => dropWithin(name),
	};
}

/**
 * @description Plans a query with sequential scans and sorts priced out, so on tables too small for
 * the planner to prefer an index, a test sees whether an index can serve the query and its order.
 * @param db The database.
 * @param query The query's SQL and parameters, from `.toSQL()`.
 * @param sorts Whether to leave sorts priced as usual, for a query whose index is a filter, not an order.
 * @returns The root plan node.
 */
export async function explain(
	db: Database,
	query: Query,
	sorts: boolean = false,
): Promise<PlanNode> {
	const [row] = await db.$client.begin(async (sql) => {
		await sql`SET LOCAL enable_seqscan = off`;

		if (!sorts) {
			await sql`SET LOCAL enable_sort = off`;
		}

		return sql.unsafe<ExplainRow[]>(
			`EXPLAIN (FORMAT JSON) ${query.sql}`,
			query.params as never[],
		);
	});

	if (!row) {
		throw new Error('EXPLAIN returned no plan.');
	}

	return row['QUERY PLAN'][0].Plan;
}

/**
 * @description Lists every node of a plan, depth first.
 * @param node The root plan node.
 * @returns The node and all its descendants.
 */
export function planNodes(node: PlanNode): PlanNode[] {
	return [node, ...(node.Plans ?? []).flatMap(planNodes)];
}

/**
 * @description Finds the nodes from a plan's root down to the scan of one relation alias, which is
 * what decides whether that relation's rows come out sorted.
 * @param node The root plan node.
 * @param alias The scanned relation's alias, e.g. `d0` for a relational query's table.
 * @returns The nodes on the path, root first; empty when the alias is not scanned.
 */
export function planPath(node: PlanNode, alias: string): PlanNode[] {
	if (node.Alias === alias) {
		return [node];
	}

	for (const child of node.Plans ?? []) {
		const path = planPath(child, alias);

		if (path.length > 0) {
			return [node, ...path];
		}
	}

	return [];
}
