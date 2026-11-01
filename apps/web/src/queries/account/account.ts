import type { SetBadgesRequest } from '@unbound-app/contracts/sponsors';
import { mutationOptions, queryOptions } from '@tanstack/react-query';

import unwrapAuthResult from '~/queries/account/unwrap-auth-result';
import { createBrowserClient } from '~/lib/api/browser-client';
import { getAccountOverview } from '~/lib/auth/account';
import { accountOverviewKey } from '~/queries/keys';
import { invalidate } from '~/queries/invalidate';
import authClient from '~/lib/auth/client';

// The sponsor contracts are classic zod; loading them on use keeps it out of the entry chunk every page loads.
async function loadBadgeClaimResponseSchema() {
	return (await import('@unbound-app/contracts/sponsors')).badgeClaimResponseSchema;
}

/**
 * @description What `/account` manages for the signed-in user: linked accounts, API keys and sponsorship.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`.
 */
export function accountOverviewQuery() {
	return queryOptions({
		queryKey: accountOverviewKey,
		queryFn: () => getAccountOverview(),
	});
}

/**
 * @description Replaces the signed-in user's sponsor badges, then refreshes the account overview and the public pages showing them.
 * @returns Mutation options taking the badges to save, in order.
 */
export function saveBadgesMutation() {
	return mutationOptions({
		mutationFn: async (body: SetBadgesRequest) =>
			createBrowserClient()('PUT /api/v1/me/badges', {
				body,
				response: await loadBadgeClaimResponseSchema(),
			}),
		onSuccess: (_data, _body, _result, context) => invalidate(context.client, 'badges'),
	});
}

/**
 * @description Removes all the signed-in user's sponsor badges, then refreshes the account overview and the public pages showing them.
 * @returns Mutation options taking no variables.
 */
export function removeBadgesMutation() {
	return mutationOptions({
		mutationFn: async () =>
			createBrowserClient()('DELETE /api/v1/me/badges', {
				response: await loadBadgeClaimResponseSchema(),
			}),
		onSuccess: (_data, _variables, _result, context) => invalidate(context.client, 'badges'),
	});
}

/**
 * @description Creates an API key, then refreshes the account overview so it is listed.
 * @returns Mutation options taking the key name and resolving to the new key, whose secret is shown once.
 */
export function createApiKeyMutation() {
	return mutationOptions({
		mutationFn: async (name: string) =>
			unwrapAuthResult(await authClient.apiKey.create({ name })),
		onSuccess: (_data, _name, _result, context) => invalidate(context.client, 'account'),
	});
}

/**
 * @description Revokes an API key, then refreshes the account overview so it is gone.
 * @returns Mutation options taking the key id.
 */
export function deleteApiKeyMutation() {
	return mutationOptions({
		mutationFn: async (keyId: string) => {
			unwrapAuthResult(await authClient.apiKey.delete({ keyId }));
		},
		onSuccess: (_data, _keyId, _result, context) => invalidate(context.client, 'account'),
	});
}

/**
 * @description Unlinks a social account, then refreshes the account overview.
 * @returns Mutation options taking the account row id.
 */
export function unlinkAccountMutation() {
	return mutationOptions({
		mutationFn: async (accountId: string) => {
			unwrapAuthResult(await authClient.unlinkAccount({ accountId }));
		},
		onSuccess: (_data, _accountId, _result, context) => invalidate(context.client, 'account'),
	});
}

/**
 * @description Starts linking a social account by sending the browser to the provider.
 * @returns Mutation options taking the provider id.
 */
export function linkSocialMutation() {
	return mutationOptions({
		// No invalidation: success leaves the page, and the provider's callback to `/account` is a full load.
		mutationFn: async (provider: 'discord' | 'github') => {
			unwrapAuthResult(await authClient.linkSocial({ provider, callbackURL: '/account' }));
		},
	});
}

export default {
	accountOverviewQuery,
	saveBadgesMutation,
	removeBadgesMutation,
	createApiKeyMutation,
	deleteApiKeyMutation,
	unlinkAccountMutation,
	linkSocialMutation,
};
