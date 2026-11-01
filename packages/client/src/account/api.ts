import {
	accountOAuthConfigSchema,
	accountSignInResponseSchema,
	meResponseSchema,
} from '@unbound-app/contracts/account';
import type { AccountSignInResponse, Caller } from '@unbound-app/contracts/account';
import { ApiRequestError, createApiClient } from '@unbound-app/web/client';
import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';
import type { Api } from '@unbound-app/web/api';

import { authorizeWithDiscord } from '~/account/discord-oauth';
import { getBucket, useBucket } from '~/storage/api';
import { EventEmitter } from '~/core/event-emitter';
import { API_URL } from '~/core/constants';

/** The Bucket the account keeps its session in. Never synced. */
export const ACCOUNT_STORE = 'unbound::account';

/** The Unbound account signed in on this device. */
export type Account = {
	/** The account's id on Unbound's servers. */
	id: string;
	/** The account's display name, refreshed from Unbound's servers at each launch. */
	name: string;
	/** The account's avatar image URL, or `null` when it has none. */
	image: string | null;
};

/** How a {@link signIn} ended. */
export type SignInResult =
	| { status: 'signed-in'; account: Account }
	| { status: 'cancelled' }
	| { status: 'failed'; error: Error };

/** A typed request function for the Unbound web API, from `createApiClient`. */
export type ApiRequest = ReturnType<typeof createApiClient<Api>>;

type Session = AccountSignInResponse;

type AccountEvent = {
	account: Account;
};

type EventMap = {
	signedIn: (payload: AccountEvent) => void;
	signedOut: (payload: AccountEvent) => void;
};

const logger = createLogger('Account');
const Store = getBucket(ACCOUNT_STORE);
const Events = new EventEmitter<EventMap>();

/** Listens for `signedIn` and `signedOut`, which also fires when the server rejects the session. */
export const on = Events.on.bind(Events);
export const off = Events.off.bind(Events);

function readSession(): Session | undefined {
	const parsed = accountSignInResponseSchema.safeParse(Store.get('session', null));

	return parsed.success ? parsed.data : undefined;
}

function toAccount(user: Caller): Account {
	return { id: user.id, name: user.name, image: user.image };
}

function clearSession(session: Session) {
	Store.remove('session');
	Events.emit('signedOut', { account: toAccount(session.user) });
}

// A request sent with an older token must not sign out a session opened since.
function expire(token: string) {
	const session = readSession();

	if (!(session?.token === token)) {
		return;
	}

	logger.warn(`The session of account ${session.user.id} expired or was revoked.`);
	clearSession(session);
}

/** @returns The signed-in account, or `undefined`. */
export function getAccount(): Account | undefined {
	const user = readSession()?.user;

	return user ? toAccount(user) : undefined;
}

/**
 * @description React hook that re-renders when the account signs in, out, or refreshes.
 * @returns The signed-in account, or `undefined`.
 */
export function useAccount(): Account | undefined {
	useBucket(ACCOUNT_STORE);

	return getAccount();
}

/**
 * @description Creates a client for the Unbound web API that sends the account's session. A `401`
 * signs the account out, since the session expired or was revoked; other failures keep it.
 * @returns A typed `request(route, options)` function, anonymous when signed out.
 */
export function createClient(): ApiRequest {
	const session = readSession();
	const headers = session ? { authorization: `Bearer ${session.token}` } : undefined;
	const request = createApiClient<Api>({ baseUrl: API_URL, headers });

	if (!session) {
		return request;
	}

	const authenticated: ApiRequest = (route, init) =>
		request(route, init).catch((cause: unknown) => {
			if (cause instanceof ApiRequestError && cause.status === 401) {
				expire(session.token);
			}

			throw cause;
		});

	return authenticated;
}

/**
 * @description Signs in through Discord's in-app authorize screen and saves the session.
 * @returns Whether the account signed in, the user cancelled, or the sign-in failed.
 */
export async function signIn(): Promise<SignInResult> {
	try {
		const request = createApiClient<Api>({ baseUrl: API_URL });
		// Production serves only the deprecated path until `/api/v1/auth/discord` deploys; switch then.
		const config = await request('GET /api/v1/sync/oauth', {
			response: accountOAuthConfigSchema,
		});
		const code = await authorizeWithDiscord(config);

		if (!code) {
			return { status: 'cancelled' };
		}

		const session = await request('POST /api/v1/sync/oauth', {
			body: { code },
			response: accountSignInResponseSchema,
		});
		const account = toAccount(session.user);

		Store.set('session', session);
		Events.emit('signedIn', { account });

		return { status: 'signed-in', account };
	} catch (error) {
		logger.error('Failed to sign in with Discord:', error);

		return { status: 'failed', error: toError(error) };
	}
}

/**
 * @description Signs out on this device, then revokes the session on Unbound's servers. The local
 * sign-out stands even when the server cannot be reached.
 */
export async function signOut(): Promise<void> {
	const session = readSession();

	if (!session) {
		return;
	}

	clearSession(session);

	try {
		const response = await fetch(new URL('/api/auth/sign-out', API_URL), {
			method: 'POST',
			headers: { authorization: `Bearer ${session.token}` },
		});

		if (!response.ok) {
			throw new Error(`Unbound answered ${response.status}.`);
		}
	} catch (error) {
		logger.warn(`Failed to revoke the session of account ${session.user.id}:`, error);
	}
}

/**
 * @description Reads the account from Unbound's servers, which also extends the session, and saves
 * the fresh profile. A rejected session signs out; a network failure keeps it.
 */
export async function refresh(): Promise<void> {
	const session = readSession();

	if (!session) {
		return;
	}

	try {
		const { user } = await createClient()('GET /api/v1/me', { response: meResponseSchema });

		if (readSession()?.token === session.token) {
			Store.set('session', { token: session.token, user });
		}
	} catch (error) {
		logger.warn(`Failed to refresh account ${session.user.id}:`, error);
	}
}
