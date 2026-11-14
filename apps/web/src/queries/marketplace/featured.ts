import type { AddonType } from '@unbound-app/contracts/addons';
import { queryOptions } from '@tanstack/react-query';

import { fetchFeaturedAddons } from '~/lib/marketplace';
import { marketplaceKey } from '~/queries/keys';

/**
 * @description Today's Featured picks for one listing tab.
 * @param type The listing's addon type.
 * @returns Options for `useQuery` and `ensureQueryData`.
 */
export function featuredQuery(type: AddonType) {
	return queryOptions({
		queryKey: [...marketplaceKey, 'featured', type],
		queryFn: ({ signal }) => fetchFeaturedAddons({ data: type, signal }),
		// The picks change once a day, so a revisit within minutes keeps the same shelf.
		staleTime: 5 * 60 * 1000,
	});
}

export default { featuredQuery };
