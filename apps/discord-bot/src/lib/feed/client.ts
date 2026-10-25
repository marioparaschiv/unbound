import type { FeedItems, FeedName, FeedPage } from '~/lib/feed/types';
import { feeds } from '~/lib/feed/feeds';

// better-auth's api-key plugin default header.
export const API_KEY_HEADER = 'x-api-key';

export type FetchFeedPage = <K extends FeedName>(
	feed: K,
	after: string | null,
	limit: number,
) => Promise<FeedPage<FeedItems[K]>>;

/**
 * @description Creates the fetcher for the web's bot feed endpoints.
 * @param baseUrl The web origin, `UNBOUND_API_URL`.
 * @param apiKey The bot's API key, `UNBOUND_API_KEY`.
 * @returns `fetchFeedPage(feed, after, limit)`, which throws on a non-2xx response or a page that fails its contract schema.
 */
export function createFeedClient(baseUrl: string, apiKey: string): FetchFeedPage {
	return async function fetchFeedPage<K extends FeedName>(
		feed: K,
		after: string | null,
		limit: number,
	): Promise<FeedPage<FeedItems[K]>> {
		const url = new URL(feeds[feed].path, baseUrl);

		url.searchParams.set('limit', String(limit));

		if (after !== null) {
			url.searchParams.set('after', after);
		}

		const response = await fetch(url, { headers: { [API_KEY_HEADER]: apiKey } });

		if (!response.ok) {
			throw new Error(`Feed ${feed} responded ${response.status} ${response.statusText}.`);
		}

		const result = feeds[feed].schema.safeParse(await response.json());

		if (!result.success) {
			throw new Error(
				`Feed ${feed} returned a page that does not match its contract: ${result.error.message}`,
			);
		}

		return result.data;
	};
}

export default { API_KEY_HEADER, createFeedClient };
