import type { SyncOAuthConfig } from '@unbound-app/contracts/sync';
import uuid from '@unbound-app/utils/uuid';

import { OAuth2 } from '~/api/metro/api';

/** What Discord's authorize screen hands its `callback`: the redirect URL on approval. */
type AuthorizeResult = {
	location?: string | null;
	canceled?: boolean;
};

// Read by hand rather than through `URL`, whose query support differs across React Native versions.
function readQuery(location: string): Record<string, string> {
	const query = location.split('#')[0]?.split('?')[1] ?? '';
	const params: Record<string, string> = {};

	for (const pair of query.split('&')) {
		const [key = '', value = ''] = pair.split('=');

		if (key) {
			params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
		}
	}

	return params;
}

/**
 * @description Opens Discord's in-app OAuth2 authorize screen and waits for the user's answer.
 * Discord never navigates to the redirect URI; it hands the redirect URL back to the callback.
 * @param config The client id, redirect URI and scopes from the server.
 * @returns The authorization code, or `undefined` when the user cancelled or the state did not match.
 */
export function authorizeWithDiscord(config: SyncOAuthConfig): Promise<string | undefined> {
	const state = uuid(32);

	return new Promise((resolve) => {
		OAuth2.openOAuth2Modal({
			clientId: config.clientId,
			redirectUri: config.redirectUri,
			scopes: config.scopes,
			responseType: 'code',
			state,
			callback: ({ location, canceled }: AuthorizeResult) => {
				if (canceled || !location) {
					resolve(undefined);

					return;
				}

				const params = readQuery(location);

				resolve(params.state === state ? params.code : undefined);
			},
		});
	});
}

export default { authorizeWithDiscord };
