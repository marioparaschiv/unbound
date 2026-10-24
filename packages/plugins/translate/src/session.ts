import { settings } from '~/modules';

export type TokenPayload = {
	accessToken?: unknown;
	refreshToken?: unknown;
	expiresIn?: unknown;
	error?: unknown;
};

type Session = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

/**
 * @description Builds a URL on the configured translate API.
 * @param path The endpoint path, starting with `/`.
 * @returns The absolute endpoint URL.
 */
export function endpoint(path: string): string {
	return settings.get('apiBaseUrl', 'https://translate.unbound.rip') + path;
}

/**
 * @description Stores the tokens the API returned from login or refresh.
 * @param payload The API's token response.
 * @returns The new access token, or `undefined` when the payload is malformed and nothing was stored.
 */
export function saveSession({
	accessToken,
	refreshToken,
	expiresIn,
}: TokenPayload): string | undefined {
	if (
		typeof accessToken !== 'string' ||
		typeof refreshToken !== 'string' ||
		typeof expiresIn !== 'number'
	) {
		return;
	}

	settings.set('accessToken', accessToken);
	settings.set('refreshToken', refreshToken);
	settings.set('expiresAt', Date.now() + expiresIn * 1000);

	return accessToken;
}

function readSession(): Session | null {
	const accessToken = settings.get('accessToken', '');
	const refreshToken = settings.get('refreshToken', '');
	const expiresAt = settings.get('expiresAt', 0);

	if (!accessToken || !refreshToken || !expiresAt) return null;

	return { accessToken, refreshToken, expiresAt };
}

function clearSession() {
	settings.remove('accessToken');
	settings.remove('refreshToken');
	settings.remove('expiresAt');
}

/**
 * @description Exchanges the stored refresh token for new tokens, signing out when the API rejects it.
 * @returns The new access token.
 */
export async function refreshSession(): Promise<string> {
	const refreshToken = settings.get('refreshToken', '');

	if (!refreshToken) {
		throw new Error('No refresh token configured. Open plugin settings and complete login.');
	}

	const response = await fetch(endpoint('/auth/refresh'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refreshToken }),
	});

	if (!response.ok) {
		if (response.status === 401) clearSession();

		const reason = await response.text().catch(() => 'refresh failed');

		throw new Error(`Auth refresh failed (${response.status}): ${reason}`);
	}

	const accessToken = saveSession((await response.json()) as TokenPayload);

	if (!accessToken) {
		throw new Error('Auth refresh returned an invalid payload.');
	}

	return accessToken;
}

/**
 * @description Returns an access token that will not expire mid-request, refreshing it when needed.
 * @returns A usable access token.
 */
export async function getAccessToken(): Promise<string> {
	const session = readSession();

	// Refresh 15 seconds early so the token cannot expire while a request is in flight.
	if (session && session.expiresAt - 15_000 > Date.now()) return session.accessToken;

	return refreshSession();
}
