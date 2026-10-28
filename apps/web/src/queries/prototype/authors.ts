import { infiniteQueryOptions } from '@tanstack/react-query';

import type { AuthorPage } from '~/lib/prototype/author-directory';
import { fetchAuthorPage } from '~/lib/prototype/author-directory';

/**
 * @description The author directory as an infinite query, one cache entry per search.
 * @param query Text the author's name must contain.
 * @returns Options for `useInfiniteQuery` and `prefetchInfiniteQuery`.
 */
export function authorsQuery(query: string) {
	const search = query.trim().toLowerCase();

	return infiniteQueryOptions({
		queryKey: ['prototype', 'authors', search],
		queryFn: ({ pageParam }) => fetchAuthorPage(pageParam, search),
		initialPageParam: 0,
		getNextPageParam: (last: AuthorPage) => last.next,
		// The directory changes slowly; a reopened menu shows what it had without asking again.
		staleTime: 5 * 60 * 1000,
	});
}

export default { authorsQuery };
