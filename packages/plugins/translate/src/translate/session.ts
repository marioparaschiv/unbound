import { settings } from '@unbound-app/settings';
import { format, messages } from '@unbound-app/i18n';

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
	return settings.apiBaseUrl + path;
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

	settings.accessToken = accessToken;
	settings.refreshToken = refreshToken;
	settings.expiresAt = Date.now() + expiresIn * 1000;

	return accessToken;
}

function readSession(): Session | null {
	const { accessToken, refreshToken, expiresAt } = settings;

	if (!accessToken || !refreshToken || !expiresAt) return null;

	return { accessToken, refreshToken, expiresAt };
}

function clearSession() {
	settings.accessToken = '';
	settings.refreshToken = '';
	settings.expiresAt = 0;
}

/**
 * @description Exchanges the stored refresh token for new tokens, signing out when the API rejects it.
 * @returns The new access token.
 */
export async function refreshSession(): Promise<string> {
	const { refreshToken } = settings;

	if (!refreshToken) throw new Error(messages.NO_REFRESH_TOKEN);

	const response = await fetch(endpoint('/auth/refresh'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refreshToken }),
	});

	if (!response.ok) {
		if (response.status === 401) clearSession();

		const reason = await response.text().catch(() => messages.REFRESH_FAILED_REASON);

		throw new Error(format('REFRESH_FAILED', { status: response.status, reason }));
	}

	const accessToken = saveSession((await response.json()) as TokenPayload);

	if (!accessToken) throw new Error(messages.REFRESH_INVALID_PAYLOAD);

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
