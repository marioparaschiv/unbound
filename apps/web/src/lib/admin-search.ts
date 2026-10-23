import type { SQL, SQLWrapper } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// The trigram FTS5 tables of the `admin_search` migration, mirroring each subject's searchable text.
const SEARCH_TABLES = {
	user: sql.raw('`user_search`'),
	addon: sql.raw('`addon_search`'),
} as const;

export type SearchSubject = keyof typeof SEARCH_TABLES;

/**
 * @description Matches the rows whose searchable text (a user's id, name and email, an addon's id and
 * name) contains the search text, case-insensitively, through the subject's trigram index.
 * @param subject Which table is searched.
 * @param id The searched table's id column.
 * @param q The search text, at least 3 characters: shorter text matches nothing in a trigram index.
 * @returns The `id in (…)` condition.
 */
export function matchesSearch(subject: SearchSubject, id: SQLWrapper, q: string): SQL {
	const table = SEARCH_TABLES[subject];
	// One quoted phrase, so FTS5 query syntax in `q` is matched as plain text.
	const phrase = `"${q.replaceAll('"', '""')}"`;

	return sql`${id} in (select \`id\` from ${table} where ${table} match ${phrase})`;
}

export default { matchesSearch };
