import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { AddonType } from '@unbound-app/contracts/addons';

import { fetchMarketplaceAuthors } from '~/lib/marketplace';

// The directory changes slowly; a reopened menu shows what it had without asking again.
const STALE_MS = 5 * 60 * 1000;

/**
 * @description One listing's author search as an infinite query, one cache entry per search.
 * @param type The listing's addon type.
 * @param q Text the author's name must contain.
 * @returns Options for `useInfiniteQuery` and `prefetchInfiniteQuery`.
 */
export function authorsQuery(type: AddonType, q: string) {
	return infiniteQueryOptions({
		queryKey: ['marketplace', 'authors', type, q],
		// The signal aborts a search the next keystroke superseded.
		queryFn: ({ pageParam, signal }) =>
			fetchMarketplaceAuthors({
				data: { type, q: q || undefined, cursor: pageParam || undefined },
				signal,
			}),
		// An empty cursor is the first page.
		initialPageParam: '',
		getNextPageParam: (last) => last.nextCursor,
		staleTime: STALE_MS,
	});
}

/**
 * @description The authors a filter picked, for its chip, whichever page of the search they sit on.
 * @param ids Their Discord ids.
 * @returns Options for `useQuery` and `ensureQueryData`.
 */
export function pickedAuthorsQuery(ids: string[]) {
	return queryOptions({
		queryKey: ['marketplace', 'picked-authors', ids],
		queryFn: async ({ signal }) =>
			(await fetchMarketplaceAuthors({ data: { ids: ids.join(',') }, signal })).authors,
		staleTime: STALE_MS,
	});
}

export default { authorsQuery, pickedAuthorsQuery };
