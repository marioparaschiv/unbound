import { addonIconResponseSchema } from '@unbound-app/contracts/addons';
import { mutationOptions } from '@tanstack/react-query';

import { createBrowserClient } from '~/lib/api/browser-client';
import { dashboardQuery } from '~/queries/dashboard/dashboard';
import { marketplaceKey } from '~/queries/marketplace/listing';

/**
 * @description Sets an addon's website icon, then refreshes the dashboard and the public pages that draw it.
 * @param addonId The addon id.
 * @returns Options for `useMutation`, taking the icon name or `null` for the type's default.
 */
export function setAddonIconMutation(addonId: string) {
	return mutationOptions({
		mutationFn: (icon: string | null) =>
			createBrowserClient()('PUT /api/v1/addons/$id/icon', {
				params: { id: addonId },
				body: { icon },
				response: addonIconResponseSchema,
			}),
		onSuccess: (_response, _icon, _result, context) =>
			Promise.all([
				context.client.invalidateQueries({ queryKey: dashboardQuery().queryKey }),
				context.client.invalidateQueries({ queryKey: marketplaceKey }),
			]),
	});
}

export default { setAddonIconMutation };
