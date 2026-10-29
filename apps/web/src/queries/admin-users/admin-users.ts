import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { ADMIN_SEARCH_MIN_LENGTH } from '@unbound-app/contracts/admin';
import type { AdminUsersSearch } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';

import { fetchAdminUser, fetchAdminUsers } from '~/lib/admin-functions';
import type { AdminUsersPage } from '~/lib/admin-users';

/** Every admin users query key starts with this, so invalidating it refreshes the list, each user's page and the pickers. */
export const adminUsersKey = ['admin-users'] as const;

/** How many users a picker's search shows. */
const USER_SEARCH_RESULTS = 5;

/**
 * @description One page of `/admin/users`; a new search or page keeps the old one on screen until it loads.
 * @param search The text filter and cursor from the URL.
 * @returns Options for `useQuery` and `ensureQueryData`.
 */
export function adminUsersQuery(search: AdminUsersSearch) {
	return queryOptions({
		queryKey: [...adminUsersKey, 'page', search],
		queryFn: ({ signal }) => fetchAdminUsers({ data: search, signal }),
		placeholderData: keepPreviousData,
		// Only a page with nothing to show goes to the error boundary; a failed refetch keeps the old one.
		throwOnError: (_error, query) => query.state.data === undefined,
	});
}

/**
 * @description The admin page of one user; its key prefixes the user's moderation log.
 * @param id The user id.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`, resolving to `null` when no user has the id.
 */
export function adminUserQuery(id: string) {
	return queryOptions({
		queryKey: [...adminUsersKey, 'detail', id],
		queryFn: ({ signal }) => fetchAdminUser({ data: id, signal }),
	});
}

/**
 * @description The users a staff picker offers for a search; a term shorter than the search minimum runs nothing.
 * @param term The trimmed, settled search text.
 * @returns Options for `useQuery`, resolving to the first few matching users.
 */
export function userSearchQuery(term: string) {
	return queryOptions({
		queryKey: [...adminUsersKey, 'search', term],
		queryFn: ({ signal }) => fetchAdminUsers({ data: { q: term }, signal }),
		select: (page: AdminUsersPage): UserSummary[] =>
			page.items
				.slice(0, USER_SEARCH_RESULTS)
				.map(({ id, name, image }) => ({ id, name, image })),
		enabled: term.length >= ADMIN_SEARCH_MIN_LENGTH,
		placeholderData: keepPreviousData,
	});
}

export default { adminUsersKey, adminUsersQuery, adminUserQuery, userSearchQuery };
