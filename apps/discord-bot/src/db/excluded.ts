import type { PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * @description References the proposed row's value for a column inside `ON CONFLICT DO UPDATE`.
 * @param column The conflicting table's column.
 * @returns `excluded."<column>"`.
 */
function excluded(column: PgColumn): SQL {
	return sql`excluded.${sql.identifier(column.name)}`;
}

/**
 * @description Builds a `WHERE` for `ON CONFLICT DO UPDATE` that is true only when a column would change.
 * @param columns The columns whose change justifies the write.
 * @returns `existing IS DISTINCT FROM excluded` over the columns, joined with `OR`.
 */
export function anyDistinct(columns: PgColumn[]): SQL {
	const checks = columns.map((column) => sql`${column} IS DISTINCT FROM ${excluded(column)}`);

	return sql.join(checks, sql` OR `);
}

/**
 * @description Builds the `SET` of an upsert that copies each column from the proposed row.
 * @param columns The columns to overwrite, keyed by their table property name.
 * @returns A `set` object for `onConflictDoUpdate`.
 */
export function fromExcluded<T extends Record<string, PgColumn>>(columns: T): Record<keyof T, SQL> {
	const entries = Object.entries(columns).map(([key, column]) => [key, excluded(column)]);

	return Object.fromEntries(entries) as Record<keyof T, SQL>;
}

export default { anyDistinct, fromExcluded };
