import { metro, storage, toasts } from '@unbound-app/api';

import type { ReviewDBCurrentUser } from '@reviewdb/entities';

const STORE = storage.getStore('unbound.reviewdb');
const CLIENT_ID = '915703782174752809';
const AUTH_REDIRECT_URI = 'https://manti.vendicated.dev/api/reviewdb/auth';
const CLIENT_MOD = 'enmity';

let currentUser: ReviewDBCurrentUser | null = null;

export function getCurrentUser(): ReviewDBCurrentUser | null {
	return currentUser;
}

export function setCurrentUser(user: ReviewDBCurrentUser | null): void {
	currentUser = user;
}

export function getToken(): string {
	return STORE.get('token', '');
}

export function hasToken(): boolean {
	return getToken().length > 0;
}

export function setToken(token: string): void {
	STORE.set('token', token);
}

export function clearToken(): void {
	STORE.remove('token');
	currentUser = null;
}

function getQueryParam(url: string, key: string): string | null {
	const queryIndex = url.indexOf('?');
	if (queryIndex < 0) return null;

	const query = url.slice(queryIndex + 1);
	if (!query) return null;

	for (const part of query.split('&')) {
		const [rawKey, rawValue = ''] = part.split('=');
		if (decodeURIComponent(rawKey ?? '') !== key) continue;
		return decodeURIComponent(rawValue.replace(/\+/g, ' '));
	}

	return null;
}

function findOAuth2AuthorizeModal(): any | null {
	if (typeof metro?.findByProps === 'function') {
		const byProp = metro.findByProps('OAuth2AuthorizeModal') as {
			OAuth2AuthorizeModal?: unknown;
		} | null;
		if (byProp?.OAuth2AuthorizeModal) return byProp.OAuth2AuthorizeModal;
	}

	if (typeof metro?.findByName === 'function') {
		return metro.findByName('OAuth2AuthorizeModal') as unknown;
	}

	return null;
}

async function handleAuthResult(location: string, onSuccess?: () => void): Promise<void> {
	const errorCode = getQueryParam(location, 'error');
	if (errorCode) {
		if (errorCode !== 'access_denied') {
			toasts.showToast({
				title: 'ReviewDB',
				content: getQueryParam(location, 'error_description') ?? errorCode,
			});
		}
		return;
	}

	if (!location.startsWith(AUTH_REDIRECT_URI)) return;

	try {
		const url = new URL(location);
		url.searchParams.append('clientMod', CLIENT_MOD);

		const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
		const payload = (await response.json().catch(() => null)) as {
			token?: unknown;
			message?: unknown;
		} | null;

		if (!response.ok) {
			throw new Error(
				typeof payload?.message === 'string' ? payload.message : 'ReviewDB login failed.',
			);
		}

		if (typeof payload?.token !== 'string') {
			throw new Error('ReviewDB login returned an invalid payload.');
		}

		setToken(payload.token);
		toasts.showToast({ title: 'ReviewDB', content: 'Successfully authorized with ReviewDB.' });
		onSuccess?.();
	} catch (error) {
		toasts.showToast({
			title: 'ReviewDB',
			content: error instanceof Error ? error.message : 'Authorization failed.',
		});
	}
}

export function authorize(onSuccess?: () => void): void {
	if (typeof metro?.findByProps !== 'function') {
		toasts.showToast({ title: 'ReviewDB', content: 'OAuth is unavailable.' });
		return;
	}

	const modals = metro.findByProps('pushModal', 'popModal') as {
		pushModal?: (options: { key: string; modal: any; closable?: boolean }) => void;
		popModal?: (key: string) => void;
	} | null;
	const OAuth2AuthorizeModal = findOAuth2AuthorizeModal();

	if (!modals?.pushModal || !modals?.popModal || !OAuth2AuthorizeModal) {
		toasts.showToast({ title: 'ReviewDB', content: 'OAuth modal is unavailable.' });
		return;
	}

	const key = 'unbound-reviewdb-oauth2-authorize';

	modals.pushModal({
		key,
		closable: true,
		modal: {
			key,
			modal: OAuth2AuthorizeModal,
			animation: 'slide-up',
			shouldPersistUnderModals: false,
			props: {
				clientId: CLIENT_ID,
				redirectUri: AUTH_REDIRECT_URI,
				scopes: ['identify'],
				responseType: 'code',
				permissions: 0n,
				cancelCompletesFlow: false,
				callback: ({ location }: { location?: string | null }) => {
					if (!location) return;
					void handleAuthResult(location, onSuccess);
				},
				dismissOAuthModal: () => modals.popModal?.(key),
			},
		},
	});
}
