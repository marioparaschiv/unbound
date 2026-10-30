import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { AdminAddonsSearch } from '@unbound-app/contracts/admin';

import { fetchAdminAddon, fetchAdminAddons } from '~/lib/admin-functions';
import { adminAddonsKey } from '~/queries/keys';

/**
 * @description One page of `/admin/addons`; a new search, filter or page keeps the old one on screen until it loads.
 * @param search The text filter, filters and cursor from the URL.
 * @returns Options for `useQuery` and `ensureQueryData`, resolving to the page and the user its maintainer filter names.
 */
export function adminAddonsQuery(search: AdminAddonsSearch) {
	return queryOptions({
		queryKey: [...adminAddonsKey, 'page', search],
		queryFn: ({ signal }) => fetchAdminAddons({ data: search, signal }),
		placeholderData: keepPreviousData,
		// Only a page with nothing to show goes to the error boundary; a failed refetch keeps the old one.
		throwOnError: (_error, query) => query.state.data === undefined,
	});
}

/**
 * @description The admin page of one addon; its key prefixes the addon's moderation log.
 * @param id The addon id.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`, resolving to `null` when no approved addon has the id.
 */
export function adminAddonQuery(id: string) {
	return queryOptions({
		queryKey: [...adminAddonsKey, 'detail', id],
		queryFn: ({ signal }) => fetchAdminAddon({ data: id, signal }),
	});
}

export default { adminAddonsQuery, adminAddonQuery };
