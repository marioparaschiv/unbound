import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { addonAuthorSchema } from '@unbound-app/contracts/manifest';

import { fetchDeveloper, fetchDevelopers } from '~/lib/developer-functions';
import { marketplaceKey } from '~/queries/marketplace/listing';

// Under the marketplace root: a write that changes the listing also changes who is credited where.
const developersKey = [...marketplaceKey, 'developers'] as const;

/**
 * @description The Team page's people as an infinite query, one cache entry per search.
 * @param search Text the name must contain; empty for everyone.
 * @returns Options for `useInfiniteQuery` and `ensureInfiniteQueryData`.
 */
export function teamQuery(search: string) {
	return infiniteQueryOptions({
		queryKey: [...developersKey, 'team', search],
		queryFn: ({ pageParam, signal }) =>
			fetchDevelopers({ data: { search, cursor: pageParam || undefined }, signal }),
		// An empty cursor is the first page.
		initialPageParam: '',
		getNextPageParam: (last) => last.nextCursor,
	});
}

/**
 * @description One person's Team profile.
 * @param discordId Their Discord id, as the URL carries it.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`; the data is `null` when nobody matches.
 */
export function developerQuery(discordId: string) {
	return queryOptions({
		queryKey: [...developersKey, 'profile', discordId],
		queryFn: async ({ signal }) => {
			const parsed = addonAuthorSchema.shape.id.safeParse(discordId);

			// Text that cannot be a Discord id matches nobody, so it needs no request.
			return parsed.success ? fetchDeveloper({ data: parsed.data, signal }) : null;
		},
	});
}

export default { teamQuery, developerQuery };
