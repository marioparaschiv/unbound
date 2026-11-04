import { authorize } from '@unbound-plugins/shared/oauth/authorize';
import { readQuery } from '@unbound-plugins/shared/oauth/query';
import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';
import { toasts } from '@unbound-app/api';

import { AUTH_REDIRECT_URI } from '~/constants';

type AuthPayload = {
	token?: unknown;
	message?: unknown;
};

function notify(content: string) {
	toasts.show({ title: messages.REVIEWDB, content });
}

async function finishLogin(location: string): Promise<boolean> {
	const { error, error_description: description } = readQuery(location);

	if (error) {
		if (error !== 'access_denied') notify(description ?? error);

		return false;
	}

	if (!location.startsWith(AUTH_REDIRECT_URI)) return false;

	const response = await fetch(`${location}&clientMod=enmity`, {
		headers: { Accept: 'application/json' },
	});
	const payload = (await response.json().catch(() => null)) as AuthPayload | null;

	if (!response.ok) {
		notify(typeof payload?.message === 'string' ? payload.message : messages.LOGIN_FAILED);

		return false;
	}

	if (typeof payload?.token !== 'string') {
		notify(messages.LOGIN_INVALID_PAYLOAD);

		return false;
	}

	settings.token = payload.token;
	notify(messages.LOGIN_SUCCESS);

	return true;
}

/**
 * @description Opens Discord's OAuth2 authorize screen for ReviewDB and stores the token it grants.
 * @param onSuccess Called once the token is stored.
 */
export async function signIn(onSuccess?: () => void): Promise<void> {
	try {
		const location = await authorize({
			clientId: '915703782174752809',
			redirectUri: AUTH_REDIRECT_URI,
			scopes: ['identify'],
		});

		if (location && (await finishLogin(location))) onSuccess?.();
	} catch (error) {
		notify(error instanceof Error ? error.message : messages.AUTHORIZATION_FAILED);
	}
}

export default { signIn };
