import { authorize } from '@unbound-plugins/shared/oauth/authorize';
import { readQuery } from '@unbound-plugins/shared/oauth/query';
import { toasts } from '@unbound-app/api';

import { AUTH_REDIRECT_URI } from '~/constants';
import { settings } from '~/modules';

type AuthPayload = {
	token?: unknown;
	message?: unknown;
};

function notify(content: string) {
	toasts.showToast({ title: 'ReviewDB', content });
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
		notify(typeof payload?.message === 'string' ? payload.message : 'ReviewDB login failed.');

		return false;
	}

	if (typeof payload?.token !== 'string') {
		notify('ReviewDB login returned an invalid payload.');

		return false;
	}

	settings.set('token', payload.token);
	notify('Successfully authorized with ReviewDB.');

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
		notify(error instanceof Error ? error.message : 'Authorization failed.');
	}
}

export default { signIn };
