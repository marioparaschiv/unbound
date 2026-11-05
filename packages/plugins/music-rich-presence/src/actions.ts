import { metro } from '@unbound-app/api';

import { LASTFM_API_KEY_URL } from '~/constants';

/** @description Opens the Last.fm page that makes an API key; the Create an API Key button runs it. */
export function createApiKey() {
	void metro.api.Linking.openURL(LASTFM_API_KEY_URL);
}
