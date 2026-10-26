import type { SQL, SQLWrapper } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

import { addon, addonSearchText, user, userSearchText } from '~/db/schema';

// FTS5's trigram index never matched fewer characters; neither does this.
const MIN_QUERY_CHARACTERS = 3;

const SEARCH_SUBJECTS = {
	user: { id: user.id, table: user, text: userSearchText },
	addon: { id: addon.id, table: addon, text: addonSearchText },
} as const;

export type SearchSubject = keyof typeof SEARCH_SUBJECTS;

/**
 * @description Matches the rows whose searchable text (a user's id, name and email, an addon's id and
 * name) contains the search text, case-insensitively, through the subject's trigram index.
 * @param subject Which table is searched.
 * @param id The searched table's id column.
 * @param q The search text, at least 3 characters: shorter text matches nothing in a trigram index.
 * @returns The `id in (…)` condition.
 */
export function matchesSearch(subject: SearchSubject, id: SQLWrapper, q: string): SQL {
	if ([...q].length < MIN_QUERY_CHARACTERS) {
		return sql`false`;
	}

	const { id: searchedId, table, text } = SEARCH_SUBJECTS[subject];
	// The LIKE wildcards in `q` match literally.
	const pattern = `%${q.replaceAll(/[\\%_]/g, (match) => `\\${match}`)}%`;

	return sql`${id} in (select ${searchedId} from ${table} where ${text} like lower(${pattern}::text collate pg_c_utf8) escape '\\')`;
}

export default { matchesSearch };
