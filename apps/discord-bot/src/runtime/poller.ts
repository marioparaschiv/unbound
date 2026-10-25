import { createLogger } from '@unbound-app/logger';
import { eq } from 'drizzle-orm';

import type { FetchFeedPage } from '~/lib/feed/client';
import { FEED_NAMES, feeds } from '~/lib/feed/feeds';
import type { FeedName } from '~/lib/feed/types';
import type { Database } from '~/db/database';
import { feedCursor } from '~/db/schema';

const logger = createLogger('Bot', 'Poller');

export type PollerOptions = {
	db: Database;
	fetchPage: FetchFeedPage;
	pageSize: number;
	intervalMs: number;
};

async function readCursor(db: Database, feed: FeedName): Promise<string | null> {
	const [row] = await db
		.select({ cursor: feedCursor.cursor })
		.from(feedCursor)
		.where(eq(feedCursor.feed, feed));

	return row?.cursor ?? null;
}

/**
 * @description Drains one feed from its stored cursor, writing each page and its cursor in one transaction.
 * @template K The feed name.
 * @param db The bot database.
 * @param feed The feed to drain.
 * @param fetchPage Fetches one page of the feed.
 * @param pageSize The `limit` of each request.
 * @returns The number of items ingested; rejects on the first failed page, which leaves rows and cursor untouched.
 */
export async function pollFeed<K extends FeedName>(
	db: Database,
	feed: K,
	fetchPage: FetchFeedPage,
	pageSize: number,
): Promise<number> {
	let after = await readCursor(db, feed);
	let ingested = 0;

	while (true) {
		const page = await fetchPage(feed, after, pageSize);
		const cursor = page.cursor ?? after;

		if (page.items.length || cursor !== after) {
			await db.transaction(async (tx) => {
				await feeds[feed].ingest(tx, page.items);

				if (cursor === null) return;

				await tx
					.insert(feedCursor)
					.values({ feed, cursor })
					.onConflictDoUpdate({
						target: feedCursor.feed,
						set: { cursor, updatedAt: new Date() },
					});
			});
		}

		ingested += page.items.length;

		if (!page.hasMore) {
			return ingested;
		}

		if (cursor === after) {
			logger.warn(
				`Feed ${feed} reported more pages without advancing its cursor; waiting for the next tick.`,
			);

			return ingested;
		}

		after = cursor;
	}
}

/**
 * @description Drains every feed once. A failing feed is logged and retried on the next tick.
 * @param options The poller's database, fetcher and page size.
 * @returns Resolves once every feed was attempted.
 */
export async function pollAll(options: PollerOptions): Promise<void> {
	for (const feed of FEED_NAMES) {
		try {
			await pollFeed(options.db, feed, options.fetchPage, options.pageSize);
		} catch (error) {
			logger.error(`Failed to poll feed ${feed}:`, error);
		}
	}
}

/**
 * @description Polls every feed now and then every `intervalMs` after the previous round finishes.
 * @param options The poller's database, fetcher, page size and interval.
 * @returns A function that stops the poller.
 */
export function startPoller(options: PollerOptions): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;

	async function tick() {
		await pollAll(options);

		if (stopped) return;

		timer = setTimeout(() => void tick(), options.intervalMs);
	}

	void tick();

	return () => {
		stopped = true;
		clearTimeout(timer);
	};
}

export default { pollFeed, pollAll, startPoller };
