import { ingestReleases } from '~/lib/feed/ingest-releases';
import type { FeedItems, FeedName } from '~/lib/feed/types';
import { ingestMembers } from '~/lib/feed/ingest-members';
import { ingestAddons } from '~/lib/feed/ingest-addons';
import { ingestEvents } from '~/lib/feed/ingest-events';
import type { Transaction } from '~/db/database';

export type Feed<T> = {
	path: string;
	ingest: (tx: Transaction, items: T[]) => Promise<void>;
};

export type FeedRegistry = { [K in FeedName]: Feed<FeedItems[K]> };

export const feeds: FeedRegistry = {
	addons: { path: '/api/v1/bot/addons', ingest: ingestAddons },
	events: { path: '/api/v1/bot/events', ingest: ingestEvents },
	releases: { path: '/api/v1/bot/releases', ingest: ingestReleases },
	members: { path: '/api/v1/bot/members', ingest: ingestMembers },
};

export const FEED_NAMES = Object.keys(feeds) as FeedName[];

export default { feeds, FEED_NAMES };
