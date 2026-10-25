import type {
	AddonFeedItem,
	EventFeedItem,
	FeedItems,
	FeedName,
	FeedPage,
	MemberFeedItem,
	ReleaseFeedItem,
} from '~/lib/feed/types';
import type { FetchFeedPage } from '~/lib/feed/client';

export type FakePages = { [K in FeedName]?: FeedPage<FeedItems[K]>[] };

export const ADDON: AddonFeedItem = {
	id: 'addon-1',
	type: 'plugin',
	name: 'Silent Typing',
	description: 'Hides your typing indicator.',
	version: '1.0.0',
	authors: [{ name: 'Mario', githubLogin: 'marioparaschiv', discordId: '1' }],
	pageUrl: 'https://unbound.rip/addons/addon-1',
	listed: true,
	updatedAt: '2026-10-01T00:00:00.000Z',
};

export const EVENT: EventFeedItem = {
	id: 1,
	kind: 'addon.delisted',
	subjectType: 'addon',
	subjectId: 'addon-1',
	subjectName: 'Silent Typing',
	actor: { id: 'user-1', name: 'Mario' },
	data: {},
	reason: null,
	createdAt: '2026-10-01T00:00:00.000Z',
};

export const RELEASE: ReleaseFeedItem = {
	platform: 'ios',
	version: '1.2.3',
	url: 'https://example.com/unbound.ipa',
	changelog: 'Fixes.',
	publishedAt: '2026-10-01T00:00:00.000Z',
};

export const MEMBER: MemberFeedItem = {
	userId: 'user-1',
	discordId: '1',
	githubId: '42',
	githubLogin: 'marioparaschiv',
	isAddonDeveloper: true,
	isSponsor: false,
	updatedAt: '2026-10-01T00:00:00.000Z',
};

export const SAMPLE_PAGES: { [K in FeedName]: FeedPage<FeedItems[K]> } = {
	addons: { items: [ADDON], cursor: 'addons-1', hasMore: false },
	events: { items: [EVENT], cursor: 'events-1', hasMore: false },
	releases: { items: [RELEASE], cursor: 'releases-1', hasMore: false },
	members: { items: [MEMBER], cursor: 'members-1', hasMore: false },
};

/**
 * @description A fetcher that serves each feed's pages in order, then empty pages, recording each `after`.
 * @param pages The pages to serve per feed.
 * @returns The fetcher and the `after` values it was called with, per feed.
 */
export function fakeFetcher(pages: FakePages) {
	const calls = new Map<FeedName, (string | null)[]>();
	const served = new Map<FeedName, number>();

	const fetchPage: FetchFeedPage = async (feed, after) => {
		const index = served.get(feed) ?? 0;
		const page = pages[feed]?.[index];

		served.set(feed, index + 1);
		calls.set(feed, [...(calls.get(feed) ?? []), after]);

		return page ?? { items: [], cursor: null, hasMore: false };
	};

	return { fetchPage, calls };
}
