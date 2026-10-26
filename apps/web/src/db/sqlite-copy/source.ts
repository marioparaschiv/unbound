import { Database } from 'bun:sqlite';

import type { SourceValue } from './codecs';
import { SQLITE_ONLY_TABLES } from './registry';
import type { TableSpec } from './registry';

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

function quote(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function columnsOf(db: Database, table: string) {
	return db
		.query<NameRow, [string]>('SELECT name FROM pragma_table_info(?)')
		.all(table)
		.map((row) => row.name);
}

function assertColumns(db: Database, spec: TableSpec) {
	const known = new Set(spec.columns.map((column) => column.name));
	const source = columnsOf(db, spec.name);
	const unknown = source.filter((name) => !known.has(name));
	const missing = [...known].filter((name) => !source.includes(name));

	if (unknown.length > 0 || missing.length > 0) {
		throw new Error(
			`Source table ${spec.name} does not match the Postgres schema: ` +
				`unknown ${unknown.map((name) => `${spec.name}.${name}`).join(', ') || 'none'}, ` +
				`missing ${missing.map((name) => `${spec.name}.${name}`).join(', ') || 'none'}.`,
		);
	}
}

function readRows(db: Database, spec: TableSpec): CanonicalRow[] {
	const columns = spec.columns.map((column) => quote(column.name)).join(', ');
	const order = spec.primaryKey.map(quote).join(', ');
	const rows = db
		.query<SourceValue[], []>(`SELECT ${columns} FROM ${quote(spec.name)} ORDER BY ${order}`)
		.values();

	return rows.map((row, index) =>
		spec.columns.map((column, position) => {
			const value = row[position] ?? null;

			if (value === null) return null;

			try {
				return column.codec.parse(value);
			} catch (error) {
				throw new Error(`${spec.name}.${column.name}, row ${index + 1} by primary key:`, {
					cause: error,
				});
			}
		}),
	);
}

/**
 * @description Reads every registry table from a SQLite file, read-only and in one snapshot, after
 * checking it holds no table or column the registry does not know.
 * @param path The SQLite file.
 * @param specs The tables to read, in the order to return them.
 * @returns Each table's rows as canonical text; throws on an unknown table or column, or a bad value.
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
				(name) => !known.has(name) && !SQLITE_ONLY_TABLES.has(name),
			);

			if (unknown.length > 0) {
				throw new Error(
					`Source tables the Postgres schema does not know: ${unknown.join(', ')}.`,
				);
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

				if (present) {
					assertColumns(db, spec);
				}

				return {
					spec,
					present,
					rows: present ? readRows(db, spec) : [],
					sequence: sequences.get(spec.name),
				};
			});
		})();
	} finally {
		db.close();
	}
}

export default { readSource };
