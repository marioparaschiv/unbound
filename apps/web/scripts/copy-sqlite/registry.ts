import type { PgColumn } from 'drizzle-orm/pg-core';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';

import * as schema from '~/db/schema';

import type { Codec } from './codecs';

import { codecs, isColumnType, wholeJsonCodec } from './codecs';

export type ColumnSpec = {
	name: string;
	/** The Postgres type, such as `timestamp(3) with time zone`, that canonical text is cast to. */
	sqlType: string;
	codec: Codec;
};

export type TableSpec = {
	name: string;
	/** In the drizzle schema's order, which is the order rows are written and checksummed in. */
	columns: ColumnSpec[];
	primaryKey: string[];
	/** The tables this one has a foreign key to. */
	references: string[];
};

const FTS_MIRRORS = ['user_search', 'addon_search'];
const FTS_SHADOWS = ['data', 'idx', 'content', 'docsize', 'config'];

/** The SQLite tables with no Postgres counterpart, which the copy reads past. */
export const SQLITE_ONLY_TABLES: ReadonlySet<string> = new Set([
	'sqlite_sequence',
	'__drizzle_migrations',
	...FTS_MIRRORS,
	...FTS_MIRRORS.flatMap((mirror) => FTS_SHADOWS.map((shadow) => `${mirror}_${shadow}`)),
]);

/** The app tables newer than production's SQLite file, which then copy as empty: #231's profiles. */
export const OPTIONAL_SOURCE_TABLES: ReadonlySet<string> = new Set(['discord_profile']);

/**
 * The `json` columns the app stores whole and never reads into with `->>`, so they copy the NUL and
 * lone surrogates it lets in (`put-sync`'s `anyJsonBody`) instead of refusing them.
 */
export const WHOLE_JSON_COLUMNS: ReadonlySet<PgColumn> = new Set([schema.syncDocument.document]);

function describeTable(table: PgTable): TableSpec {
	const config = getTableConfig(table);
	const columns = config.columns.map((column) => {
		if (!isColumnType(column.columnType)) {
			throw new Error(
				`${config.name}.${column.name} is a ${column.columnType}, which has no codec.`,
			);
		}

		return {
			name: column.name,
			sqlType: column.getSQLType(),
			codec: WHOLE_JSON_COLUMNS.has(column) ? wholeJsonCodec : codecs[column.columnType],
		};
	});
	const primaryKey =
		config.primaryKeys[0]?.columns.map((column) => column.name) ??
		config.columns.filter((column) => column.primary).map((column) => column.name);

	if (primaryKey.length === 0) {
		throw new Error(`${config.name} has no primary key to order its rows by.`);
	}

	const references = config.foreignKeys.map(
		(key) => getTableConfig(key.reference().foreignTable).name,
	);

	return { name: config.name, columns, primaryKey, references: [...new Set(references)] };
}

/**
 * @description Orders tables so each comes after every table it references.
 * @param tables The tables, in any order.
 * @returns The tables in foreign key order, ties broken by name.
 */
export function inReferenceOrder(tables: TableSpec[]): TableSpec[] {
	const pending = [...tables].sort((a, b) => a.name.localeCompare(b.name));
	const placed = new Set<string>();
	const ordered: TableSpec[] = [];

	while (pending.length > 0) {
		const table = pending.find((candidate) =>
			candidate.references.every((name) => name === candidate.name || placed.has(name)),
		);

		if (!table) {
			throw new Error(
				`Foreign keys form a cycle among ${pending.map((t) => t.name).join(', ')}.`,
			);
		}

		pending.splice(pending.indexOf(table), 1);
		placed.add(table.name);
		ordered.push(table);
	}

	return ordered;
}

/** Every table of the app's Postgres schema, in foreign key order. */
export const tables: TableSpec[] = inReferenceOrder(
	Object.values(schema)
		.filter((value) => is(value, PgTable))
		.map(describeTable),
);

export default {
	OPTIONAL_SOURCE_TABLES,
	SQLITE_ONLY_TABLES,
	WHOLE_JSON_COLUMNS,
	inReferenceOrder,
	tables,
};
