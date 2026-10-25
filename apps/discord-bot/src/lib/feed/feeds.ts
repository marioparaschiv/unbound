import type { ZodMiniType } from 'zod/mini';

import {
	botAddonsResponseSchema,
	botEventsResponseSchema,
	botMembersResponseSchema,
	botReleasesResponseSchema,
} from '~/lib/feed/types';
import type { FeedItems, FeedName, FeedPage } from '~/lib/feed/types';
import { ingestReleases } from '~/lib/feed/ingest-releases';
import { ingestMembers } from '~/lib/feed/ingest-members';
import { ingestAddons } from '~/lib/feed/ingest-addons';
import { ingestEvents } from '~/lib/feed/ingest-events';
import type { Transaction } from '~/db/database';

export type Feed<T> = {
	path: string;
	/** Validates a response page; a page that fails is not ingested and its cursor does not move. */
	schema: ZodMiniType<FeedPage<T>>;
	ingest: (tx: Transaction, items: T[]) => Promise<void>;
};

export type FeedRegistry = { [K in FeedName]: Feed<FeedItems[K]> };

export const feeds: FeedRegistry = {
	addons: { path: '/api/v1/bot/addons', schema: botAddonsResponseSchema, ingest: ingestAddons },
	events: { path: '/api/v1/bot/events', schema: botEventsResponseSchema, ingest: ingestEvents },
	releases: {
		path: '/api/v1/bot/releases',
		schema: botReleasesResponseSchema,
		ingest: ingestReleases,
	},
	members: {
		path: '/api/v1/bot/members',
		schema: botMembersResponseSchema,
		ingest: ingestMembers,
	},
};

export const FEED_NAMES = Object.keys(feeds) as FeedName[];

export default { feeds, FEED_NAMES };
