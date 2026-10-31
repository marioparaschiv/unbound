import { queryOptions } from '@tanstack/react-query';

import { dashboardPageKey } from '~/queries/keys';
import { getDashboard } from '~/lib/publishing';

/**
 * @description The signed-in user's `/dashboard`: their addons, recent submissions and GitHub link.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`.
 */
export function dashboardQuery() {
	return queryOptions({
		queryKey: dashboardPageKey,
		queryFn: () => getDashboard(),
	});
}

export default { dashboardQuery };
