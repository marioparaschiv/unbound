import type { AddonType } from '@unbound-app/contracts/addons';
import { queryOptions } from '@tanstack/react-query';

import { fetchMarketplaceTags } from '~/lib/marketplace';

/**
 * @description Every tag with its addon count for one listing, for the Tags menu and chips.
 * @param type The listing's addon type.
 * @returns Options for `useQuery` and `ensureQueryData`.
 */
export function tagsQuery(type: AddonType) {
	return queryOptions({
		queryKey: ['marketplace', 'tags', type],
		queryFn: ({ signal }) => fetchMarketplaceTags({ data: type, signal }),
		// Tags change only by hand in the database.
		staleTime: 5 * 60 * 1000,
	});
}

export default { tagsQuery };
