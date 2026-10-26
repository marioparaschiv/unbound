import { BOT_FEED_DEFAULT_LIMIT } from '@unbound-app/contracts/bot';
import type { BotFeedQuery } from '@unbound-app/contracts/bot';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { afterKey, decodeCursor, encodeCursor } from '~/lib/keyset';
import { requirePermission } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import type { BotFeed } from '~/db/schema/bot';
import type { Caller } from '~/lib/api/caller';
import type { CursorKey } from '~/lib/keyset';
import { botFeedChange } from '~/db/schema';

export type FeedRequest = NonNullable<BotFeedQuery>;

export type FeedPage<T> = {
	items: T[];
	/** The position of the last row read; the request's `after` when it read none. */
	cursor: string | null;
	hasMore: boolean;
};

/** The rows of one read, cut to a page, with the cursor past them. */
export type RowPage<R> = Omit<FeedPage<R>, 'items'> & { rows: R[] };

/** A key of a change feed, as its latest change left it. */
export type FeedChange = {
	key: string;
	seq: number;
	changedAt: Date;
};

/** A feed over `bot_feed_change`: the keys in change order, read back as items. */
export type ChangeFeed<T> = {
	name: BotFeed;
	/** Reads the items of a page of changed keys, by key; a key with nothing to show is left out. */
	hydrate: (ctx: AppContext, changes: FeedChange[]) => Promise<Map<string, T>>;
};

// A change key is never empty, which keeps the two cursor shapes apart.
const CHANGE_CURSOR = z.tuple([z.int(), z.string().min(1)]);

/**
 * @description Fails with `forbidden` unless the caller may read the bot feeds.
 * @param caller The resolved caller.
 */
export function requireBotReader(caller: Caller): void {
	requirePermission(caller, { bot: ['read'] });
}

/**
 * @description Cuts the rows of one read (a page plus one lookahead row) to a page.
 * @template R The row type.
 * @param rows The rows read, at most `limit + 1`.
 * @param limit The page size.
 * @param after The cursor the rows were read after.
 * @param keyOf Reads a row's position.
 * @returns The page's rows, the cursor past the last one, and whether more rows follow.
 */
export function toRowPage<R>(
	rows: R[],
	limit: number,
	after: string | undefined,
	keyOf: (row: R) => CursorKey,
): RowPage<R> {
	const page = rows.slice(0, limit);
	const last = page.at(-1);

	return {
		rows: page,
		cursor: last ? encodeCursor(keyOf(last)) : (after ?? null),
		hasMore: rows.length > limit,
	};
}

/**
 * @description Reads a page of a change feed: the keys changed after the cursor, in change order,
 * each as it is now. Keys that hydrate to nothing are skipped but still advance the cursor.
 * @template T The feed's item type.
 * @param ctx The application context.
 * @param caller The caller; needs `bot:read`.
 * @param feed The feed.
 * @param request The cursor and page size.
 * @returns The page.
 */
export async function readChangeFeed<T>(
	ctx: AppContext,
	caller: Caller,
	feed: ChangeFeed<T>,
	request: FeedRequest = {},
): Promise<FeedPage<T>> {
	requireBotReader(caller);

	const { after, limit = BOT_FEED_DEFAULT_LIMIT } = request;
	const position = after ? decodeCursor(after, CHANGE_CURSOR) : undefined;

	const rows = await ctx.db
		.select({
			key: botFeedChange.key,
			seq: botFeedChange.seq,
			changedAt: botFeedChange.changedAt,
		})
		.from(botFeedChange)
		.where(
			and(
				eq(botFeedChange.feed, feed.name),
				position
					? afterKey([botFeedChange.seq, botFeedChange.key], position, 'asc')
					: undefined,
			),
		)
		.orderBy(asc(botFeedChange.seq), asc(botFeedChange.key))
		.limit(limit + 1);

	const page = toRowPage(rows, limit, after, (row) => [row.seq, row.key]);
	const items = page.rows.length ? await feed.hydrate(ctx, page.rows) : new Map<string, T>();

	return {
		items: page.rows.flatMap((row) => items.get(row.key) ?? []),
		cursor: page.cursor,
		hasMore: page.hasMore,
	};
}

export default { requireBotReader, toRowPage, readChangeFeed };
