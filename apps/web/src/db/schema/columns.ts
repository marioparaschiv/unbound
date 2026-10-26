import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { index, timestamp } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * @description Declares a timestamp column. Precision 3 is a JS `Date`'s, so a value read back, or put
 * in a cursor through `getTime()`, equals the stored one exactly.
 * @param name The column name.
 * @returns A `timestamptz(3)` column read and written as a `Date`.
 */
export function timestampMs(name: string) {
	return timestamp(name, { withTimezone: true, precision: 3, mode: 'date' });
}

/**
 * @description Builds the text admin search matches a row by: its columns joined by spaces, lowercased
 * with Unicode simple case mapping, as FTS5's trigram tokenizer folded it.
 * @param columns The columns to search, in order; each must be `not null`.
 * @returns `lower((a || ' ' || b …) collate pg_c_utf8)`.
 */
export function searchText(columns: AnyPgColumn[]): SQL {
	return sql`lower((${sql.join(columns, sql` || ' ' || `)}) collate pg_c_utf8)`;
}

/**
 * @description Declares the trigram index that serves `like '%q%'` on a search expression.
 * @param name The index name.
 * @param text The expression, from {@link searchText}.
 * @returns A GIN `gin_trgm_ops` index on the expression.
 */
export function trigramIndex(name: string, text: SQL) {
	return index(name).using('gin', sql`(${text}) gin_trgm_ops`);
}

export default { timestampMs, searchText, trigramIndex };
