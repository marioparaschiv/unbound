import { createLogger } from '@unbound-app/logger';
import { Database } from 'bun:sqlite';

import type { SourceValue } from './codecs';
import type { TableSpec } from './registry';

import {
	OPTIONAL_SOURCE_COLUMNS,
	OPTIONAL_SOURCE_TABLES,
	RETIRED_SOURCE_TABLES,
	SQLITE_ONLY_TABLES,
} from './registry';
import quote from './quote';

/** A row as canonical text per column, `null` for SQL NULL. */
export type CanonicalRow = (string | null)[];

export type SourceTable = {
	spec: TableSpec;
	/** False when the source predates the table, which then copies as empty. */
	present: boolean;
	/** Ordered by primary key. */
	rows: CanonicalRow[];
	/** The table's `sqlite_sequence` high-water mark, past any deleted id. */
	sequence: bigint | undefined;
};

type NameRow = {
	name: string;
};

type SequenceRow = {
	name: string;
	seq: bigint;
};

type CountRow = {
	count: bigint;
};

const logger = createLogger('Web', 'Copy');

// Only labels a row in an error, so invalid UTF-8 in a key may show as U+FFFD.
function label(value: SourceValue | undefined) {
	return value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value);
}

function columnsOf(db: Database, table: string) {
	return db
		.query<NameRow, [string]>('SELECT name FROM pragma_table_info(?)')
		.all(table)
		.map((row) => row.name);
}

function isOptionalColumn(spec: TableSpec, name: string) {
	return OPTIONAL_SOURCE_COLUMNS.has(`${spec.name}.${name}`);
}

// Returns the source's columns once they are known to match the registry.
function assertColumns(db: Database, spec: TableSpec): string[] {
	const known = new Set(spec.columns.map((column) => column.name));
	const source = columnsOf(db, spec.name);
	const unknown = source.filter((name) => !known.has(name));
	const missing = [...known].filter(
		(name) => !source.includes(name) && !isOptionalColumn(spec, name),
	);

	if (unknown.length > 0 || missing.length > 0) {
		throw new Error(
			`Source table ${spec.name} does not match the Postgres schema: ` +
				`unknown ${unknown.map((name) => `${spec.name}.${name}`).join(', ') || 'none'}, ` +
				`missing ${missing.map((name) => `${spec.name}.${name}`).join(', ') || 'none'}.`,
		);
	}

	return source;
}

function readRows(db: Database, spec: TableSpec, source: string[]): CanonicalRow[] {
	const columns = spec.columns
		.map((column) =>
			source.includes(column.name) ? column.codec.select(quote(column.name)) : 'NULL',
		)
		.join(', ');
	const order = spec.primaryKey.map(quote).join(', ');
	const rows = db
		.query<SourceValue[], []>(`SELECT ${columns} FROM ${quote(spec.name)} ORDER BY ${order}`)
		.values();

	const keyPositions = spec.primaryKey.map((name) =>
		spec.columns.findIndex((column) => column.name === name),
	);

	return rows.map((row) =>
		spec.columns.map((column, position) => {
			const value = row[position] ?? null;

			if (value === null) return null;

			try {
				return column.codec.parse(value);
			} catch (error) {
				// Names the row by its key, never by the value that failed.
				const key = keyPositions.map((at) => JSON.stringify(label(row[at]))).join(', ');

				throw new Error(
					`${spec.name}.${column.name} at (${spec.primaryKey.join(', ')}) = (${key}):`,
					{ cause: error },
				);
			}
		}),
	);
}

/**
 * @description Reads every registry table from a SQLite file, read-only and in one snapshot, after
 * checking it holds every app table but the optional ones and no table or column the registry does not know,
 * and logs each retired table it skips with its row count.
 * @param path The SQLite file.
 * @param specs The tables to read, in the order to return them.
 * @returns Each table's rows as canonical text; throws on a missing or unknown table, an unknown column,
 * or a bad value.
 */
export function readSource(path: string, specs: TableSpec[]): SourceTable[] {
	const db = new Database(path, { readonly: true, safeIntegers: true, strict: true });

	try {
		return db.transaction(() => {
			const names = db
				.query<NameRow, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
				.all()
				.map((row) => row.name);
			const known = new Set(specs.map((spec) => spec.name));
			const unknown = names.filter(
				(name) =>
					!known.has(name) &&
					!SQLITE_ONLY_TABLES.has(name) &&
					!RETIRED_SOURCE_TABLES.has(name),
			);

			if (unknown.length > 0) {
				throw new Error(
					`Source tables the Postgres schema does not know: ${unknown.join(', ')}.`,
				);
			}

			if (!specs.some((spec) => names.includes(spec.name))) {
				throw new Error(
					`The source holds none of the app tables; is ${path} the app's SQLite file?`,
				);
			}

			const missing = specs
				.map((spec) => spec.name)
				.filter((name) => !names.includes(name) && !OPTIONAL_SOURCE_TABLES.has(name));

			if (missing.length > 0) {
				throw new Error(`The source lacks the app tables ${missing.join(', ')}.`);
			}

			for (const name of names.filter((table) => RETIRED_SOURCE_TABLES.has(table))) {
				const row = db
					.query<CountRow, []>(`SELECT count(*) AS count FROM ${quote(name)}`)
					.get();

				logger.info(`Skipped the retired table ${name} (${row?.count ?? 0} rows).`);
			}

			const sequences = new Map(
				names.includes('sqlite_sequence')
					? db
							.query<SequenceRow, []>('SELECT name, seq FROM sqlite_sequence')
							.all()
							.map((row) => [row.name, row.seq] as const)
					: [],
			);

			return specs.map((spec) => {
				const present = names.includes(spec.name);

				return {
					spec,
					present,
					rows: present ? readRows(db, spec, assertColumns(db, spec)) : [],
					sequence: sequences.get(spec.name),
				};
			});
		})();
	} finally {
		db.close();
	}
}

export default { readSource };
