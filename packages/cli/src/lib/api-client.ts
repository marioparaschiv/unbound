import { API_KEY_HEADER, createApiClient } from '@unbound-app/web/client';
import type { Api } from '@unbound-app/web/api';

import { getCredentialsPath, type Env } from '~/lib/env';
import { readCredentials } from '~/lib/credentials';

/**
 * @description Builds the credentials the API is called with: the `UNBOUND_API_KEY` when set (CI),
 * otherwise the session `ubd login` stored for this API origin.
 * @param env The validated environment.
 * @returns The authentication headers.
 */
function getAuthHeaders(env: Env): Headers {
	if (env.UNBOUND_API_KEY) {
		return new Headers({ [API_KEY_HEADER]: env.UNBOUND_API_KEY });
	}

	const credentials = readCredentials(getCredentialsPath(env));

	if (!credentials) {
		throw new Error('Not logged in. Run `ubd login`, or set UNBOUND_API_KEY.');
	}

	if (credentials.apiUrl !== env.UNBOUND_API_URL) {
		throw new Error(
			`Logged in to ${credentials.apiUrl}, not ${env.UNBOUND_API_URL}. Run \`ubd login\` again.`,
		);
	}

	return new Headers({ authorization: `Bearer ${credentials.token}` });
}

/**
 * @description Creates the typed Unbound API client, authenticated as {@link getAuthHeaders} resolves.
 * @param env The validated environment.
 * @returns The typed `request(route, options)` function.
 */
export function createClient(env: Env) {
	return createApiClient<Api>({ baseUrl: env.UNBOUND_API_URL, headers: getAuthHeaders(env) });
}

export default { getAuthHeaders, createClient };
