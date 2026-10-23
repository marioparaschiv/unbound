import type { PageDirection } from '@unbound-app/contracts/admin';
import type { SortOrder } from '@unbound-app/contracts/addons';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';

import { ApiError } from '~/lib/api/errors';

/** A row's position in a keyset list: its sort value, then its id to break ties. */
export type CursorKey = [value: string | number, id: string];

/** The sort column and the id column a keyset list is ordered by. */
export type KeyColumns = [value: SQLWrapper, id: SQLWrapper];

export type KeysetRequest = {
	cursor?: string;
	dir?: PageDirection;
};

export type KeysetPage<T> = {
	items: T[];
	/** Pass with `dir: 'next'` for the following page; `null` on the last page. */
	next: string | null;
	/** Pass with `dir: 'prev'` for the preceding page; `null` on the first page. */
	prev: string | null;
};

/**
 * @description Serializes a row's position as an opaque cursor.
 * @param key The row's sort value and id.
 * @returns The base64url cursor.
 */
export function encodeCursor(key: CursorKey): string {
	return Buffer.from(JSON.stringify(key)).toString('base64url');
}

/**
 * @description Parses a cursor from {@link encodeCursor}, failing with `invalid_request` on anything
 * that is not one or belongs to a list with another key shape.
 * @param cursor The cursor from the request.
 * @param schema The list's key shape.
 * @returns The row position.
 */
export function decodeCursor(cursor: string, schema: z.ZodType<CursorKey>): CursorKey {
	try {
		return schema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
	} catch {
		throw new ApiError('invalid_request', 'The cursor does not belong to this list.');
	}
}

/**
 * @description Picks the order rows are read in: the list order for `next`, reversed for `prev` so
 * the rows nearest the cursor come first.
 * @param order The list's display order.
 * @param dir The paging direction.
 * @returns The order to read rows in.
 */
export function scanOrder(order: SortOrder, dir: PageDirection = 'next'): SortOrder {
	if (dir === 'next') {
		return order;
	}

	return order === 'asc' ? 'desc' : 'asc';
}

/**
 * @description Builds the row-value comparison that keeps only the rows past the cursor in the read
 * order, so the sort index is entered at the cursor instead of skipped through.
 * @param columns The sort and id columns.
 * @param key The cursor's position.
 * @param order The list's display order.
 * @param dir The paging direction.
 * @returns `(value, id) > (?, ?)` or `<`.
 */
export function afterKey(
	columns: KeyColumns,
	key: CursorKey,
	order: SortOrder,
	dir: PageDirection = 'next',
): SQL {
	const operator = scanOrder(order, dir) === 'asc' ? sql`>` : sql`<`;

	return sql`(${columns[0]}, ${columns[1]}) ${operator} (${key[0]}, ${key[1]})`;
}

/**
 * @description Turns the rows of one read (a page plus one lookahead row, in read order) into a page in
 * display order with the cursors on either side of it.
 * @template T The row type.
 * @param rows The rows read, at most `size + 1`.
 * @param size The page size.
 * @param request The cursor and direction the rows were read with.
 * @param keyOf Reads a row's position.
 * @returns The page and its cursors.
 */
export function toKeysetPage<T>(
	rows: T[],
	size: number,
	request: KeysetRequest,
	keyOf: (row: T) => CursorKey,
): KeysetPage<T> {
	const more = rows.length > size;
	const read = rows.slice(0, size);
	const backwards = request.dir === 'prev';
	const items = backwards ? read.toReversed() : read;
	const first = items.at(0);
	const last = items.at(-1);

	// Reading backwards came from a later page and reading forwards from an earlier one, so that side
	// always has rows; the lookahead row decides the other side.
	const hasNext = backwards ? Boolean(request.cursor) : more;
	const hasPrev = backwards ? more : Boolean(request.cursor);

	return {
		items,
		next: hasNext && last ? encodeCursor(keyOf(last)) : null,
		prev: hasPrev && first ? encodeCursor(keyOf(first)) : null,
	};
}

export default { encodeCursor, decodeCursor, scanOrder, afterKey, toKeysetPage };
