import { createHash } from 'node:crypto';
import postgres from 'postgres';

import { migrateDatabase } from '~/db/migrate';

import type { CanonicalRow, SourceTable } from './source';
import type { TableSpec } from './registry';
import { readSource } from './source';
import { tables } from './registry';

export type CopyOptions = {
	/** The SQLite file, opened read-only. */
	sqlitePath: string;
	/** The Postgres database, `DATABASE_DIRECT_URL`. */
	targetUrl: string;
	/** Truncates a non-empty target and copies again, instead of refusing. */
	replace?: boolean;
	/** The tables to copy; the app schema's registry unless a test swaps a codec. */
	specs?: TableSpec[];
};

export type TableReport = {
	table: string;
	/** False when the source predates the table. */
	present: boolean;
	rows: number;
	/** The sha256 of the source's canonical rows. */
	checksum: string;
	match: boolean;
};

type OwnedSequence = {
	sequence: string;
	/** Null for a sequence no column owns. */
	table: string | null;
	column: string | null;
};

type HighRow = {
	high: string | null;
};

/** Thrown when the target already holds rows and `replace` is off. */
export class TargetNotEmptyError extends Error {
	constructor(readonly tables: string[]) {
		super(
			`The target already holds rows in ${tables.join(', ')}; pass --replace to truncate and copy again.`,
		);
	}
}

/** Thrown when a table's rows read back from Postgres differ from the source. */
export class VerificationError extends Error {
	constructor(readonly reports: TableReport[]) {
		const failed = reports.filter((report) => !report.match).map((report) => report.table);

		super(`The copy does not match the source in ${failed.join(', ')}; rolled back.`);
	}
}

// Postgres binds at most 65535 parameters per statement.
const MAX_PARAMETERS = 65_535;
const MAX_BATCH_ROWS = 1000;

function quote(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * @description Hashes canonical rows, one JSON array per line, so a `null` and any string differ.
 * @param rows The rows, in primary key order.
 * @returns The hex sha256.
 */
export function checksum(rows: CanonicalRow[]): string {
	const hash = createHash('sha256');

	for (const row of rows) {
		hash.update(`${JSON.stringify(row)}\n`);
	}

	return hash.digest('hex');
}

async function lockTables(tx: postgres.TransactionSql, specs: TableSpec[]) {
	for (const spec of specs) {
		await tx.unsafe(`ALTER TABLE ${quote(spec.name)} DISABLE TRIGGER USER`);
	}
}

async function enableTriggers(tx: postgres.TransactionSql, specs: TableSpec[]) {
	for (const spec of specs) {
		await tx.unsafe(`ALTER TABLE ${quote(spec.name)} ENABLE TRIGGER USER`);
	}
}

async function clearTarget(tx: postgres.TransactionSql, specs: TableSpec[], replace: boolean) {
	const occupied: string[] = [];

	for (const spec of specs) {
		const [row] = await tx.unsafe(`SELECT 1 FROM ${quote(spec.name)} LIMIT 1`);

		if (row) {
			occupied.push(spec.name);
		}
	}

	if (occupied.length === 0) return;

	if (!replace) {
		throw new TargetNotEmptyError(occupied);
	}

	await tx.unsafe(
		`TRUNCATE ${specs.map((spec) => quote(spec.name)).join(', ')} RESTART IDENTITY CASCADE`,
	);
}

async function insertRows(tx: postgres.TransactionSql, table: SourceTable) {
	const { spec, rows } = table;
	const width = spec.columns.length;
	const batch = Math.min(MAX_BATCH_ROWS, Math.floor(MAX_PARAMETERS / width));
	const columns = spec.columns.map((column) => quote(column.name)).join(', ');
	// Bound as text, so postgres.js sends the encoded text as is instead of serializing it for the
	// column's type (it would JSON-encode a json string), and Postgres parses it.
	const casts = spec.columns.map((column) => `::text::${column.sqlType}`);

	for (let start = 0; start < rows.length; start += batch) {
		const chunk = rows.slice(start, start + batch);
		const parameters = chunk.flatMap((row) =>
			row.map((value, position) =>
				value === null ? null : (spec.columns[position]?.codec.encode(value) ?? null),
			),
		);
		const values = chunk
			.map((_, index) => {
				const placeholders = casts.map(
					(cast, position) => `$${index * width + position + 1}${cast}`,
				);

				return `(${placeholders.join(', ')})`;
			})
			.join(', ');

		await tx.unsafe(
			`INSERT INTO ${quote(spec.name)} (${columns}) VALUES ${values}`,
			parameters,
		);
	}
}

// Every sequence must belong to a copied column, or the copy could leave one behind its ids.
async function advanceSequences(tx: postgres.TransactionSql, source: SourceTable[]) {
	const owned = await tx<OwnedSequence[]>`
		select s.relname as sequence, t.relname as "table", a.attname as column
		from pg_class s
		join pg_namespace n on n.oid = s.relnamespace and n.nspname = current_schema()
		left join pg_depend d on d.objid = s.oid and d.classid = 'pg_class'::regclass
			and d.refclassid = 'pg_class'::regclass and d.deptype in ('a', 'i')
		left join pg_class t on t.oid = d.refobjid
		left join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
		where s.relkind = 'S'`;

	for (const { sequence, table, column } of owned) {
		const copied = source.find((entry) => entry.spec.name === table);

		if (!copied || !column) {
			throw new Error(`Sequence ${sequence} is not owned by a copied column.`);
		}

		const [row] = await tx.unsafe<HighRow[]>(
			`SELECT max(${quote(column)})::text AS high FROM ${quote(copied.spec.name)}`,
		);
		const isRowid = copied.spec.primaryKey.length === 1 && copied.spec.primaryKey[0] === column;
		const candidates = [row?.high, isRowid ? copied.sequence : undefined]
			.filter((value) => value !== null && value !== undefined)
			.map(BigInt);

		if (candidates.length === 0) {
			continue;
		}

		const high = candidates.reduce((a, b) => (a > b ? a : b));

		await tx`select setval(${sequence}::regclass, ${String(high)}::bigint, true)`;
	}
}

async function verify(tx: postgres.TransactionSql, source: SourceTable[]): Promise<TableReport[]> {
	const reports: TableReport[] = [];

	for (const { spec, present, rows } of source) {
		const columns = spec.columns.map((column) => column.codec.readBack(quote(column.name)));
		const order = spec.primaryKey.map(quote).join(', ');
		const target = await tx
			.unsafe(`SELECT ${columns.join(', ')} FROM ${quote(spec.name)} ORDER BY ${order}`)
			.values();
		const expected = checksum(rows);
		const match = target.length === rows.length && checksum(target) === expected;

		reports.push({ table: spec.name, present, rows: rows.length, checksum: expected, match });
	}

	return reports;
}

/**
 * @description Copies every app table from the SQLite file into Postgres in one transaction, after
 * migrating the target: triggers off, rows in foreign key order, sequences past the copied ids, and
 * every table's rows read back and checksummed against the source before commit.
 * @param options The source file, the target URL, and whether to replace a non-empty target.
 * @returns One report per table; rejects, having rolled back, on a non-empty target without
 * `replace` ({@link TargetNotEmptyError}), on any mismatch ({@link VerificationError}), or on a source
 * table, column or value the schema cannot hold.
 */
export async function copySqlite(options: CopyOptions): Promise<TableReport[]> {
	const { sqlitePath, targetUrl, replace = false, specs = tables } = options;
	const source = readSource(sqlitePath, specs);

	await migrateDatabase(targetUrl);

	const sql = postgres(targetUrl, { max: 1, onnotice: () => void 0 });

	try {
		return await sql.begin(async (tx) => {
			await lockTables(tx, specs);
			await clearTarget(tx, specs, replace);

			for (const table of source) {
				await insertRows(tx, table);
			}

			await advanceSequences(tx, source);

			const reports = await verify(tx, source);

			if (reports.some((report) => !report.match)) {
				throw new VerificationError(reports);
			}

			await enableTriggers(tx, specs);

			return reports;
		});
	} finally {
		await sql.end();
	}
}

export default { checksum, copySqlite, TargetNotEmptyError, VerificationError };
