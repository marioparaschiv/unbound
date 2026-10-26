import type { SQL, SQLWrapper } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * @description Matches rows whose column contains the search text, case-insensitively for ASCII, with
 * the LIKE wildcards in the text matched literally.
 * @param column The column to search.
 * @param search The raw search text.
 * @returns The `like` condition.
 */
export function likeContains(column: SQLWrapper, search: string): SQL {
	const pattern = `%${search.replaceAll(/[\\%_]/g, (match) => `\\${match}`)}%`;

	// Under the database's libc C ctype, `ilike` folds ASCII only, as SQLite's `like` did.
	return sql`${column} ilike ${pattern} escape '\\'`;
}

export default likeContains;
