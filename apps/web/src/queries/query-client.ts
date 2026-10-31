import { QueryClient } from '@tanstack/react-query';

/** What every route's `context` carries: the one query cache that loaders fill and components read. */
export type RouterContext = {
	queryClient: QueryClient;
};

/**
 * @description Creates the query cache for one request on the server, or for the page's lifetime on the client.
 * @returns The client.
 */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			// Data the server just rendered is fresh, so hydration does not refetch it on the client at once.
			queries: { staleTime: 60 * 1000 },
		},
	});
}

export default { createQueryClient };
