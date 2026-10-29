import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';

import unwrapAuthResult from '~/queries/account/unwrap-auth-result';
import { marketplaceKey } from '~/queries/marketplace/listing';
import { getSession } from '~/lib/auth/session';
import authClient from '~/lib/auth/client';

/** The session's query key; the root `beforeLoad` reads it into `context.session`. */
export const sessionKey = ['session'] as const;

// Roots whose data is the same for every visitor, so they survive a sign-out.
const PUBLIC_ROOTS = new Set<string>([marketplaceKey[0]]);

/**
 * @description The signed-in user, read by the root `beforeLoad` so client navigations reuse it instead of asking the server.
 * @returns Options for `fetchQuery`, resolving to the session or `null` when signed out.
 */
export function sessionQuery() {
	return queryOptions({
		queryKey: sessionKey,
		queryFn: () => getSession(),
		// Changes in this tab reset it; five minutes bounds how long a change made elsewhere goes unseen.
		staleTime: 5 * 60 * 1000,
	});
}

/**
 * @description Starts a Discord sign-in by sending the browser to Discord.
 * @returns Mutation options taking where Discord sends the user back to.
 */
export function signInMutation() {
	return mutationOptions({
		mutationFn: async (callbackURL: string) => {
			unwrapAuthResult(await authClient.signIn.social({ provider: 'discord', callbackURL }));
		},
	});
}

/**
 * @description Signs the user out, reloads the session and drops every cached query that belonged to them.
 * @param router The app router, whose context holds the session.
 * @param redirectTo A page to leave for before the session reloads, or none to stay put.
 * @returns Mutation options taking no variables.
 */
export function signOutMutation(router: AnyRouter, redirectTo?: string) {
	return mutationOptions({
		mutationFn: async () => {
			unwrapAuthResult(await authClient.signOut());
		},
		onSuccess: async (_data, _variables, _result, context) => {
			if (redirectTo) {
				await router.navigate({ to: redirectTo });
			}

			// The reload reads the session from the cache, so the cached one goes first.
			context.client.removeQueries({ queryKey: sessionKey });
			await router.invalidate();
			// Only after the reload, once no signed-in page still reads them. The session goes again, so the
			// next navigation reads whoever signs in next in this tab.
			context.client.removeQueries({
				predicate: (query) => !PUBLIC_ROOTS.has(String(query.queryKey[0])),
			});
		},
	});
}

export default { sessionKey, sessionQuery, signInMutation, signOutMutation };
