import type { AddonType } from '@unbound-app/contracts/addons';
import { infiniteQueryOptions } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { fetchMarketplacePage, type MarketplaceSearch } from '~/lib/marketplace';
import { pickedAuthorsQuery, authorsQuery } from '~/queries/marketplace/authors';
import { sortOrder, splitList } from '~/lib/addon-filters';
import { tagsQuery } from '~/queries/marketplace/tags';

/**
 * @description The `/plugins` or `/themes` listing as an infinite query, one cache entry per URL search.
 * @param type The listing's addon type.
 * @param search The URL's search, filters and sort.
 * @returns Options for `useSuspenseInfiniteQuery` and `ensureInfiniteQueryData`.
 */
export function listingQuery(type: AddonType, search: MarketplaceSearch) {
	return infiniteQueryOptions({
		queryKey: ['marketplace', 'listing', type, search],
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
 * @returns Resolves once the results and tags are cached; the authors stream in after.
 */
export async function prefetchListing(
	queryClient: QueryClient,
	type: AddonType,
	search: MarketplaceSearch,
): Promise<void> {
	const picked = splitList(search.authors);

	// Not awaited: the Author menu is a click away, and its first page hydrates when it lands.
	void queryClient.prefetchInfiniteQuery(authorsQuery(type, ''));

	await Promise.all([
		queryClient.ensureInfiniteQueryData(listingQuery(type, search)),
		queryClient.ensureQueryData(tagsQuery(type)),
		picked.length > 0 ? queryClient.ensureQueryData(pickedAuthorsQuery(picked)) : undefined,
	]);
}

export default { listingQuery, prefetchListing };
