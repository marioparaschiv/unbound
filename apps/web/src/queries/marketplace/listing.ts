import type { AddonType } from '@unbound-app/contracts/addons';
import type { LoaderFnContext } from '@tanstack/react-router';
import { infiniteQueryOptions } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { sortOrder, splitList, type MarketplaceSearch } from '~/lib/addon-filters';
import { pickedAuthorsQuery } from '~/queries/marketplace/authors';
import { fetchMarketplacePage } from '~/lib/marketplace';
import { tagsQuery } from '~/queries/marketplace/tags';
import { marketplaceKey } from '~/queries/keys';

type LoaderCause = LoaderFnContext['cause'];

/**
 * @description The `/plugins` or `/themes` listing as an infinite query, one cache entry per URL search.
 * @param type The listing's addon type.
 * @param search The URL's search, filters and sort.
 * @returns Options for `useSuspenseInfiniteQuery` and `ensureInfiniteQueryData`.
 */
export function listingQuery(type: AddonType, search: MarketplaceSearch) {
	return infiniteQueryOptions({
		queryKey: [...marketplaceKey, 'listing', type, search],
		queryFn: ({ pageParam, signal }) =>
			fetchMarketplacePage({
				data: {
					...search,
					type,
					order: sortOrder(search.sort ?? 'name'),
					cursor: pageParam || undefined,
				},
				signal,
			}),
		// An empty cursor is the first page.
		initialPageParam: '',
		getNextPageParam: (last) => last.nextCursor,
	});
}

/**
 * @description Fills the cache a listing page reads, so its HTML ships with the results and the Tags menu.
 * @param queryClient The router's query cache.
 * @param type The listing's addon type.
 * @param search The URL's search, filters and sort.
 * @param cause Why the route loads; `stay` is a search changed on the page.
 * @returns Resolves once the results and tags are cached, or at once for a search changed on the page.
 */
export async function prefetchListing(
	queryClient: QueryClient,
	type: AddonType,
	search: MarketplaceSearch,
	cause: LoaderCause,
): Promise<void> {
	const picked = splitList(search.authors);

	// The fetches start here rather than after the next render, but the old results stay up until they land.
	if (cause === 'stay') {
		void queryClient.prefetchInfiniteQuery(listingQuery(type, search));

		if (picked.length > 0) {
			void queryClient.prefetchQuery(pickedAuthorsQuery(picked));
		}

		return;
	}

	await Promise.all([
		queryClient.ensureInfiniteQueryData(listingQuery(type, search)),
		queryClient.ensureQueryData(tagsQuery(type)),
		picked.length > 0 ? queryClient.ensureQueryData(pickedAuthorsQuery(picked)) : undefined,
	]);
}

export default { listingQuery, prefetchListing };
