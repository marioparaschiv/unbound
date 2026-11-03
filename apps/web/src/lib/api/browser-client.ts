import { createApiClient } from '~/api/schema-client';
import type { Api } from '~/api';

export type ApiRequest = ReturnType<typeof createApiClient<Api>>;

/**
 * @description Creates the typed API client for browser code. It calls the page's own origin, where
 * the session cookie authenticates it; call it in event handlers, since there is no page origin
 * during server rendering.
 * @returns The typed `request(route, options)` function.
 */
export function createBrowserClient(): ApiRequest {
	return createApiClient<Api>({ baseUrl: window.location.origin });
}

export default createBrowserClient;
