import { authorize } from '@unbound-plugins/shared/oauth/authorize';
import { readQuery } from '@unbound-plugins/shared/oauth/query';
import { messages, format } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';

import { endpoint, saveSession, type TokenPayload } from '~/lib/session';

function notify(content: string) {
	toasts.show({ title: messages.TRANSLATE, content });
}

async function finishLogin(location: string, redirectUri: string) {
	const params = readQuery(location);

	if (params.error) {
		if (params.error !== 'access_denied') notify(params.error_description || params.error);

		return;
	}

	if (!location.startsWith(redirectUri) || !params.code || !params.state) return;

	const response = await fetch(location, { headers: { Accept: 'application/json' } });
	const raw = await response.text();
	let payload: TokenPayload;

	try {
		payload = JSON.parse(raw);
	} catch {
		throw new Error(
			response.ok ? messages.LOGIN_INVALID_PAYLOAD : raw.trim() || messages.LOGIN_FAILED,
		);
	}

	if (!response.ok) {
		throw new Error(typeof payload.error === 'string' ? payload.error : messages.LOGIN_FAILED);
	}

	if (!saveSession(payload)) throw new Error(messages.LOGIN_INVALID_PAYLOAD);

	notify(messages.LOGIN_COMPLETED);
}

/**
 * @description Signs the user in to the translate API through Discord's OAuth2 authorize screen.
 * @returns A promise that settles when the flow ends, whether it succeeded, failed, or was cancelled.
 */
export async function connectDiscord(): Promise<void> {
	const redirectUri = endpoint('/auth/callback');

	try {
		const login = await fetch(endpoint('/auth/login'), { redirect: 'manual' });
		const { client_id: clientId, state } = readQuery(
			login.headers.get('location') ?? login.url,
		);

		if (!clientId || !state) {
			notify(
				login.ok
					? messages.OAUTH_INCOMPLETE
					: format('SERVICE_UNAVAILABLE', { status: login.status }),
			);

			return;
		}

		const location = await authorize({
			clientId,
			redirectUri,
			state,
			scopes: ['identify', 'email', 'guilds'],
		});

		if (location) await finishLogin(location, redirectUri);
	} catch (error) {
		notify(error instanceof Error ? error.message : messages.LOGIN_UNEXPECTED_FAILURE);
	}
}

export default { connectDiscord };
