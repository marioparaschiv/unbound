import type { BotReads } from '@unbound-app/web/bot';

import type { DispatcherContext } from '~/dispatchers/types';
import type { Database } from '~/db/database';

/** The table a consumer records each handled event in, one row per event id, never deleted. */
export type CursorTable = {
	/** The newest recorded event id; undefined while the table is empty. */
	last: (db: Database) => Promise<number | undefined>;
	/** Records an event as handled without handling it: the floor the consumer starts after. */
	floor: (db: Database, eventId: number) => Promise<void>;
};

export type EventCursorOptions<T> = {
	table: CursorTable;
	/** Up to `limit` events after `eventId` the consumer handles, in event id order. */
	after: (web: BotReads, eventId: number, limit: number) => Promise<T[]>;
};

/** One consumer's place in the moderation event stream. */
export type EventCursor<T> = {
	/**
	 * Hands every event after the cursor to `handlePage`, a page at a time; the page's events must be
	 * recorded in the table by the time it resolves, and a throw ends the run where it stopped.
	 */
	drain: (context: DispatcherContext, handlePage: (page: T[]) => Promise<void>) => Promise<void>;
};

const PAGE = 100;

/**
 * @description Creates a consumer's cursor over the moderation event stream, kept in its own table.
 * @template T The event shape the consumer reads.
 * @param options The consumer's table and its page read.
 * @returns The cursor.
 */
export function createEventCursor<T>({ table, after }: EventCursorOptions<T>): EventCursor<T> {
	// Events are handled one at a time in id order and event ids are commit-ordered, so every event
	// up to the newest recorded one is handled: that id is the whole cursor.
	async function position({ db, web }: DispatcherContext) {
		const last = await table.last(db);

		if (last !== undefined) {
			return last;
		}

		// An empty table: never enabled here, so enabling handles no history. An empty stream floors at 0.
		const floor = await web.newestEventId();

		await table.floor(db, floor);

		return floor;
	}

	return {
		async drain(context, handlePage) {
			// Only an empty page ends the run: a read may drop rows it cannot parse, so a short page is
			// not proof the stream ended.
			for (;;) {
				const page = await after(context.web, await position(context), PAGE);

				if (!page.length) return;

				await handlePage(page);
			}
		},
	};
}

export default { createEventCursor };
