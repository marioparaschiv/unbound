import type { FileRoutesByTo } from '~/routeTree.gen';

export const AUTH_ERROR_PATH = '/auth/error' satisfies keyof FileRoutesByTo;

/** The code the auth handler sends when Better Auth rate-limits a browser navigation. */
export const RATE_LIMITED_CODE = 'rate_limited';

export type AuthErrorKind = 'rate-limited' | 'banned' | 'denied' | 'expired' | 'unknown';

// Better Auth's OAuth callback codes, grouped by what the user can do about them.
const KINDS: Record<string, AuthErrorKind> = {
	[RATE_LIMITED_CODE]: 'rate-limited',
	BANNED_USER: 'banned',
	access_denied: 'denied',
	signup_disabled: 'denied',
	account_not_linked: 'denied',
	email_not_found: 'denied',
	unable_to_get_user_info: 'denied',
	invalid_callback_request: 'denied',
	state_mismatch: 'expired',
	state_not_found: 'expired',
	payload_expired: 'expired',
	please_restart_the_process: 'expired',
	invalid_code: 'expired',
	no_code: 'expired',
};

/**
 * @description Classifies a Better Auth error code into the page the user should see.
 * @param code The `error` query parameter Better Auth redirected with.
 * @returns The error kind, or `unknown` for codes without a dedicated page.
 */
export function getAuthErrorKind(code: string | undefined): AuthErrorKind {
	if (!code) return 'unknown';

	return KINDS[code] ?? 'unknown';
}

export default { AUTH_ERROR_PATH, RATE_LIMITED_CODE, getAuthErrorKind };
