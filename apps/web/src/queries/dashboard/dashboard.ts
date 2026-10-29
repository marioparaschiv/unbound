import { queryOptions } from '@tanstack/react-query';

import { getDashboard } from '~/lib/publishing';

/** Every dashboard query key starts with this, so invalidating it refreshes the page and its maintainer lists. */
export const dashboardKey = ['dashboard'] as const;

/**
 * @description The signed-in user's `/dashboard`: their addons, recent submissions and GitHub link.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`.
 */
export function dashboardQuery() {
	return queryOptions({
		queryKey: [...dashboardKey, 'page'],
		queryFn: () => getDashboard(),
	});
}

export default { dashboardKey, dashboardQuery };
