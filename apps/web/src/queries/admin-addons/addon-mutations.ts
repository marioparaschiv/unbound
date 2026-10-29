import { addonResponseSchema, maintainersResponseSchema } from '@unbound-app/contracts/addons';
import type { EditAddonRequest, ServeVersionRequest } from '@unbound-app/contracts/admin';
import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '@tanstack/react-query';

import { submitAddonEdit, submitServeVersion } from '~/lib/admin-functions';
import { adminAddonsKey } from '~/queries/admin-addons/admin-addons';
import { adminUsersKey } from '~/queries/admin-users/admin-users';
import { createBrowserClient } from '~/lib/api/browser-client';
import { marketplaceKey } from '~/queries/marketplace/listing';

export type TransferAddonVariables = {
	id: string;
	userId: string;
};

export type ServeVersionVariables = {
	id: string;
	request: ServeVersionRequest;
};

export type EditAddonVariables = {
	id: string;
	edit: EditAddonRequest;
};

// A user's admin page lists their addons, and the public listing shows what an addon serves.
async function invalidateAddon(client: QueryClient) {
	await Promise.all([
		client.invalidateQueries({ queryKey: adminAddonsKey }),
		client.invalidateQueries({ queryKey: adminUsersKey }),
		client.invalidateQueries({ queryKey: marketplaceKey }),
	]);
}

/**
 * @description Hides an addon from listings and update checks, then refreshes the pages that show it.
 * @returns Mutation options taking the addon id.
 */
export function delistAddonMutation() {
	return mutationOptions({
		mutationFn: (id: string) =>
			createBrowserClient()('POST /api/v1/addons/$id/delist', {
				params: { id },
				response: addonResponseSchema,
			}),
		onSuccess: (_data, _id, _result, context) => invalidateAddon(context.client),
	});
}

/**
 * @description Lists a delisted addon again, then refreshes the pages that show it.
 * @returns Mutation options taking the addon id.
 */
export function relistAddonMutation() {
	return mutationOptions({
		mutationFn: (id: string) =>
			createBrowserClient()('POST /api/v1/addons/$id/relist', {
				params: { id },
				response: addonResponseSchema,
			}),
		onSuccess: (_data, _id, _result, context) => invalidateAddon(context.client),
	});
}

/**
 * @description Makes a user an addon's owner, then refreshes the pages that show it.
 * @returns Mutation options taking the addon id and the new owner.
 */
export function transferAddonMutation() {
	return mutationOptions({
		mutationFn: ({ id, userId }: TransferAddonVariables) =>
			createBrowserClient()('POST /api/v1/addons/$id/transfer', {
				params: { id },
				body: { userId },
				response: maintainersResponseSchema,
			}),
		onSuccess: (_data, _variables, _result, context) => invalidateAddon(context.client),
	});
}

/**
 * @description Makes one approved version the one an addon serves, then refreshes the pages that show it.
 * @returns Mutation options taking the addon id and the serve request.
 */
export function serveVersionMutation() {
	return mutationOptions({
		mutationFn: ({ id, request }: ServeVersionVariables) =>
			submitServeVersion({ data: { id, request } }),
		onSuccess: (_data, _variables, _result, context) => invalidateAddon(context.client),
	});
}

/**
 * @description Saves the addon settings form, then refreshes the pages that show the addon.
 * @returns Mutation options taking the addon id and the form's values.
 */
export function editAddonMutation() {
	return mutationOptions({
		mutationFn: ({ id, edit }: EditAddonVariables) => submitAddonEdit({ data: { id, edit } }),
		onSuccess: (_data, _variables, _result, context) => invalidateAddon(context.client),
	});
}

export default {
	delistAddonMutation,
	relistAddonMutation,
	transferAddonMutation,
	serveVersionMutation,
	editAddonMutation,
};
