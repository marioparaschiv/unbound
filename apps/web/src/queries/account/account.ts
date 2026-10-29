import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { Badge } from '@unbound-app/contracts/sponsors';
import type { QueryClient } from '@tanstack/react-query';

import unwrapAuthResult from '~/queries/account/unwrap-auth-result';
import { createBrowserClient } from '~/lib/api/browser-client';
import { marketplaceKey } from '~/queries/marketplace/listing';
import { getAccountOverview } from '~/lib/auth/account';
import authClient from '~/lib/auth/client';

/** Every account query key starts with this, so invalidating it refreshes `/account`. */
export const accountKey = ['account'] as const;

const overviewKey = [...accountKey, 'overview'] as const;

// The sponsor contracts are classic zod; loading them on use keeps it out of the entry chunk every page loads.
async function loadBadgeClaimResponseSchema() {
	return (await import('@unbound-app/contracts/sponsors')).badgeClaimResponseSchema;
}

// The badge also shows next to the user on addon pages and the Team pages.
function refreshBadge(client: QueryClient) {
	return Promise.all([
		client.invalidateQueries({ queryKey: overviewKey }),
		client.invalidateQueries({ queryKey: marketplaceKey }),
	]);
}

/**
 * @description What `/account` manages for the signed-in user: linked accounts, API keys and sponsorship.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`.
 */
export function accountOverviewQuery() {
	return queryOptions({
		queryKey: overviewKey,
		queryFn: () => getAccountOverview(),
	});
}

/**
 * @description Sets the signed-in user's sponsor badge, then refreshes the account overview and the public pages showing it.
 * @returns Mutation options taking the badge to save.
 */
export function saveBadgeMutation() {
	return mutationOptions({
		mutationFn: async (badge: Badge) =>
			createBrowserClient()('PUT /api/v1/me/badge', {
				body: badge,
				response: await loadBadgeClaimResponseSchema(),
			}),
		onSuccess: (_data, _badge, _result, context) => refreshBadge(context.client),
	});
}

/**
 * @description Removes the signed-in user's sponsor badge, then refreshes the account overview and the public pages showing it.
 * @returns Mutation options taking no variables.
 */
export function removeBadgeMutation() {
	return mutationOptions({
		mutationFn: async () =>
			createBrowserClient()('DELETE /api/v1/me/badge', {
				response: await loadBadgeClaimResponseSchema(),
			}),
		onSuccess: (_data, _variables, _result, context) => refreshBadge(context.client),
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
		onSuccess: (_data, _name, _result, context) =>
			context.client.invalidateQueries({ queryKey: overviewKey }),
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
		onSuccess: (_data, _keyId, _result, context) =>
			context.client.invalidateQueries({ queryKey: overviewKey }),
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
		onSuccess: (_data, _accountId, _result, context) =>
			context.client.invalidateQueries({ queryKey: overviewKey }),
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
	accountKey,
	accountOverviewQuery,
	saveBadgeMutation,
	removeBadgeMutation,
	createApiKeyMutation,
	deleteApiKeyMutation,
	unlinkAccountMutation,
	linkSocialMutation,
};
