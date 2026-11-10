import { createApiClient } from '@unbound-app/web/client';
import type { Api } from '@unbound-app/web/api';

import { API_URL } from '~/core/constants';

/** A typed request function for the Unbound web API. */
export type ApiRequest = ReturnType<typeof createApiClient<Api>>;

export type UnboundClientOptions = {
	/** The session token to send; anonymous without one. */
	token?: string;
	/** Origin of the Unbound web API; tests point it at a local server. */
	baseUrl?: string;
};

/**
 * @description Creates a client for the Unbound web API, the one adapter every feature reaches unbound.rip through.
 * @param options The session token to send, if any, and the API origin.
 * @returns A typed `request(route, options)` function.
 */
export function createUnboundClient({
	token,
	baseUrl = API_URL,
}: UnboundClientOptions = {}): ApiRequest {
	const headers = token ? { authorization: `Bearer ${token}` } : undefined;

	return createApiClient<Api>({ baseUrl, headers });
}
