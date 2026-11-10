import { parse, Type, type StaticDecode, type TSchema } from '@unbound-app/contracts/schema';
import type { PageDirection } from '@unbound-app/contracts/admin';
import type { SortOrder } from '@unbound-app/contracts/addons';
import { isPostgresSafe } from '@unbound-app/contracts/text';
import type { Query, SQL, SQLWrapper } from 'drizzle-orm';
import { asc, desc, sql } from 'drizzle-orm';

import { ApiError } from '~/lib/api/errors';

/** A row's position in a keyset list as a cursor carries it: its sort value, then its id. */
export type CursorKey = [value: string | number, id: string];

/** A decoded cursor's position, with a timestamp back as a `Date`. */
export type CursorPosition = [value: string | number | Date, id: string];

// The last millisecond of year 9999: later, toISOString() writes an extended year Postgres rejects.
const MAX_DATE_MS = Date.UTC(10_000, 0, 1) - 1;

/** A cursor's timestamp: epoch milliseconds up to the end of year 9999, decoded to a `Date`. */
export const cursorTime = Type.Codec(Type.Integer({ minimum: 0, maximum: MAX_DATE_MS }))
	.Decode((ms) => new Date(ms))
	.Encode((date) => date.getTime());

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

/** The parts of one page's read a keyset list splices into its relational query. */
export type KeysetClauses<K extends string, TPosition> = {
	/** Keeps the rows past the cursor in read order; `undefined` on the first page. */
	where(table: Record<K, SQLWrapper>): SQL | undefined;
	/** The key columns in read order. */
	orderBy(table: Record<K, SQLWrapper>): SQL[];
	/** One page plus the lookahead row that says whether another follows. */
	limit: number;
	/** The decoded cursor, for filters that tighten around it. */
	after: TPosition | undefined;
	/** The order rows are read in: the list order, reversed for a `prev` page. */
	read: SortOrder;
};

/** A built relational query, run by awaiting it. */
export type RelationalQuery<TRow> = PromiseLike<TRow[]> & { toSQL(): Query };

/** One page of a keyset list, built but not yet read. */
export type KeysetList<TRow> = {
	/** The statement, for plan tests. */
	toSQL(): Query;
	/** Reads the page in display order with the cursors on either side of it. */
	page(): Promise<KeysetPage<TRow>>;
};

export type KeysetListOptions<K extends string, S extends TSchema, TRow> = {
	/** The row fields the list is ordered by: the sort value, then the id. */
	key: readonly [value: K, id: K];
	/** The decoded cursor's shape, a `[value, id]` tuple. */
	schema: S;
	request: KeysetRequest;
	/** The display order. */
	order: SortOrder;
	size: number;
	/** Builds the relational query around the page's clauses. */
	query(clauses: KeysetClauses<K, StaticDecode<S>>): RelationalQuery<TRow>;
};

/**
 * @description Serializes a row's position as an opaque cursor.
 * @param key The row's sort values, ending with its id.
 * @returns The base64url cursor.
 */
export function encodeCursor(key: readonly CursorKey[number][]): string {
	return Buffer.from(JSON.stringify(key)).toString('base64url');
}

/**
 * @description Parses a cursor from {@link encodeCursor}, failing with `invalid_request` on anything
 * that is not one or belongs to a list with another key shape.
 * @template T The list's key schema.
 * @param cursor The cursor from the request.
 * @param schema The list's key shape.
 * @returns The row position.
 */
export function decodeCursor<T extends TSchema>(cursor: string, schema: T): StaticDecode<T> {
	try {
		const key = JSON.parse(Buffer.from(cursor, 'base64url').toString());

		if (!isPostgresSafe(key)) {
			throw new Error('Text Postgres cannot store in a cursor.');
		}

		return parse(schema, key);
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
function scanOrder(order: SortOrder, dir: PageDirection = 'next'): SortOrder {
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
	key: CursorPosition,
	order: SortOrder,
	dir: PageDirection = 'next',
): SQL {
	const operator = scanOrder(order, dir) === 'asc' ? sql`>` : sql`<`;
	const [column, idColumn] = columns;
	// drizzle turns postgres.js's own Date serializer off, so a Date is bound as its column would bind it.
	const value = key[0] instanceof Date ? key[0].toISOString() : key[0];

	return sql`(${column}, ${idColumn}) ${operator} (${value}, ${key[1]})`;
}

function toKeysetPage<T>(
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

	const fromCursor = Boolean(request.cursor);
	const hasNext = backwards ? fromCursor : more;
	const hasPrev = backwards ? more : fromCursor;

	return {
		items,
		next: hasNext && last ? encodeCursor(keyOf(last)) : null,
		prev: hasPrev && first ? encodeCursor(keyOf(first)) : null,
	};
}

// UNKNOWN: a cursor decoded by the list's own schema, which must decode to a `[value, id]` position.
function requirePosition(value: unknown): CursorPosition {
	const [sort, id]: unknown[] = Array.isArray(value) ? value : [];

	if (
		typeof id === 'string' &&
		(typeof sort === 'string' || typeof sort === 'number' || sort instanceof Date)
	) {
		return [sort, id];
	}

	throw new Error('Failed to read a keyset cursor: its schema does not decode to [value, id].');
}

function readKey<K extends string>(row: Record<K, unknown>, key: readonly [K, K]): CursorKey {
	const [value, id] = [row[key[0]], row[key[1]]];
	const sort = value instanceof Date ? value.getTime() : value;

	if ((typeof sort !== 'string' && typeof sort !== 'number') || typeof id !== 'string') {
		throw new Error(`Failed to read the keyset key ${key.join(', ')} of a row.`);
	}

	return [sort, id];
}

/**
 * @description Builds one page of a list paged by `(value, id)`: decodes the cursor, seeks past it,
 * orders by the key, reads one lookahead row and turns the rows into a page with cursors that encode
 * the same key fields the query orders by.
 * @template K The key's row fields.
 * @template S The cursor schema.
 * @template TRow The row type.
 * @param options The key, cursor schema, request, order, page size and query.
 * @returns The page's statement and its reader.
 */
export function keysetList<K extends string, S extends TSchema, TRow extends Record<K, unknown>>(
	options: KeysetListOptions<K, S, TRow>,
): KeysetList<TRow> {
	const { key, schema, request, order, size } = options;
	const after = request.cursor ? decodeCursor(request.cursor, schema) : undefined;
	const position = after === undefined ? undefined : requirePosition(after);
	const read = scanOrder(order, request.dir);
	const direction = read === 'asc' ? asc : desc;
	const columns = (table: Record<K, SQLWrapper>): KeyColumns => [table[key[0]], table[key[1]]];
	const statement = options.query({
		where: (table) =>
			position ? afterKey(columns(table), position, order, request.dir) : undefined,
		orderBy: (table) => columns(table).map((column) => direction(column)),
		limit: size + 1,
		after,
		read,
	});

	return {
		toSQL: () => statement.toSQL(),
		page: async () => toKeysetPage(await statement, size, request, (row) => readKey(row, key)),
	};
}

export default { cursorTime, encodeCursor, decodeCursor, afterKey, keysetList };
