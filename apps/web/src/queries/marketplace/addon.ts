import { queryOptions } from '@tanstack/react-query';

import { marketplaceKey } from '~/queries/marketplace/listing';
import { fetchMarketplaceAddon } from '~/lib/marketplace';

/**
 * @description A listed addon's public page.
 * @param id The addon id.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`; the data is `null` when it is not listed.
 */
export function addonQuery(id: string) {
	return queryOptions({
		queryKey: [...marketplaceKey, 'addon', id],
		queryFn: ({ signal }) => fetchMarketplaceAddon({ data: id, signal }),
	});
}

export default { addonQuery };
