import { maintainersResponseSchema } from '@unbound-app/contracts/addons';
import type { MaintainersResponse } from '@unbound-app/contracts/addons';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { createBrowserClient } from '~/lib/api/browser-client';
import { invalidate } from '~/queries/invalidate';
import { dashboardKey } from '~/queries/keys';

function maintainersKey(addonId: string) {
	return [...dashboardKey, 'maintainers', addonId] as const;
}

/**
 * @description The maintainers of an addon the user owns, read when its maintainers dialog opens.
 * @param addonId The addon id.
 * @returns Options for `useQuery` and `prefetchQuery`.
 */
export function maintainersQuery(addonId: string) {
	return queryOptions({
		queryKey: maintainersKey(addonId),
		queryFn: () =>
			createBrowserClient()('GET /api/v1/addons/$id/maintainers', {
				params: { id: addonId },
				response: maintainersResponseSchema,
			}),
	});
}

async function applyMaintainers(
	client: QueryClient,
	addonId: string,
	response: MaintainersResponse,
) {
	client.setQueryData(maintainersKey(addonId), response);
	// The public addon page, the Team pages and the Author filter credit maintainers too.
	await invalidate(client, 'maintainedAddon');
}

/**
 * @description Adds a maintainer to an addon, then shows the new list and refreshes the dashboard and public pages.
 * @param addonId The addon id.
 * @returns Options for `useMutation`, taking the new maintainer's user id.
 */
export function addMaintainerMutation(addonId: string) {
	return mutationOptions({
		mutationFn: (userId: string) =>
			createBrowserClient()('POST /api/v1/addons/$id/maintainers', {
				params: { id: addonId },
				body: { userId },
				response: maintainersResponseSchema,
			}),
		onSuccess: (response, _userId, _result, context) =>
			applyMaintainers(context.client, addonId, response),
	});
}

/**
 * @description Removes a maintainer from an addon, then shows the new list and refreshes the dashboard and public pages.
 * @param addonId The addon id.
 * @returns Options for `useMutation`, taking the removed maintainer's user id.
 */
export function removeMaintainerMutation(addonId: string) {
	return mutationOptions({
		mutationFn: (userId: string) =>
			createBrowserClient()('DELETE /api/v1/addons/$id/maintainers/$userId', {
				params: { id: addonId, userId },
				response: maintainersResponseSchema,
			}),
		onSuccess: (response, _userId, _result, context) =>
			applyMaintainers(context.client, addonId, response),
	});
}

export default { maintainersQuery, addMaintainerMutation, removeMaintainerMutation };
