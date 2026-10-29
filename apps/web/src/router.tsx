import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createRouter } from '@tanstack/react-router';

import { createQueryClient } from '~/queries/query-client';

import { routeTree } from './routeTree.gen';

type SearchValues = Record<string, string | number | undefined>;

// The default parser turns numeric text into numbers, which rounds a Discord id such as
// `?authors=100000000000000100`. Every search param here is text, so values stay text.
function parseSearch(search: string): Record<string, string> {
	return Object.fromEntries(new URLSearchParams(search));
}

function stringifySearch(search: SearchValues): string {
	const params = new URLSearchParams();

	for (const [key, value] of Object.entries(search)) {
		if (value !== undefined) {
			params.set(key, String(value));
		}
	}

	const query = params.toString();

	return query ? `?${query}` : '';
}

/**
 * @description Creates the app router; TanStack Start calls this once per request on the server and
 * once on the client.
 * @returns The router over the generated route tree, sharing one query cache with its loaders.
 */
export function getRouter() {
	const queryClient = createQueryClient();
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		context: { queryClient },
		parseSearch,
		stringifySearch,
		// Hovering or focusing a link runs its loaders early; the query cache, not the router, decides what is fresh.
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 0,
	});

	// Streams what loaders prefetch into the HTML, hydrates it into the client's cache, and provides the client.
	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
}
