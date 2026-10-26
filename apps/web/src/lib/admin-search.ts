import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// FTS5's trigram index never matched fewer characters; neither does this.
const MIN_QUERY_CHARACTERS = 3;

/**
 * @description Matches the rows whose searchable text (a user's id, name and email, an addon's id and
 * name) contains the search text, case-insensitively, through the trigram index on that text.
 * @param text The listed table's search text, from `userSearchText` or `addonSearchText`.
 * @param q The search text, at least 3 characters: shorter text matches nothing in a trigram index.
 * @returns The `like` condition on the search text.
 */
export function matchesSearch(text: SQL, q: string): SQL {
	// Counted in code points, as trigrams are.
	if (Array.from(q).length < MIN_QUERY_CHARACTERS) {
		return sql`false`;
	}

	// The LIKE wildcards in `q` match literally.
	const pattern = `%${q.replaceAll(/[\\%_]/g, (match) => `\\${match}`)}%`;

	return sql`${text} like lower(${pattern}::text collate pg_c_utf8) escape '\\'`;
}

export default { matchesSearch };
