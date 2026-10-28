import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createRouter } from '@tanstack/react-router';

import { createQueryClient } from '~/queries/query-client';

import { routeTree } from './routeTree.gen';

/**
 * @description Creates the app router; TanStack Start calls this once per request on the server and
 * once on the client.
 * @returns The router over the generated route tree, sharing one query cache with its loaders.
 */
export function getRouter() {
	const queryClient = createQueryClient();
	const router = createRouter({ routeTree, scrollRestoration: true, context: { queryClient } });

	// Streams what loaders prefetch into the HTML, hydrates it into the client's cache, and provides the client.
	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
}
