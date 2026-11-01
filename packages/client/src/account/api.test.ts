import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { meResponseSchema } from '@unbound-app/contracts/account';

const ALICE = { id: 'user-alice', name: 'Alice', image: null, role: 'user' };

// Bearer tokens the fake Unbound server knows, and how it answers `GET /api/v1/me` for each.
const ME_ANSWERS: Record<string, () => Response> = {
	'token-valid': () => Response.json({ user: { ...ALICE, name: 'Alice Renamed' } }),
	'token-revoked': () =>
		Response.json({ error: { code: 'unauthorized', message: 'Sign in.' } }, { status: 401 }),
	'token-down': () =>
		Response.json({ error: { code: 'internal_error', message: 'Down.' } }, { status: 503 }),
};

const revoked: string[] = [];
let issuedToken = 'token-valid';

function bearer(request: Request): string {
	return request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
}

const server = Bun.serve({
	port: 0,
	routes: {
		'/api/v1/sync/oauth': {
			GET: () =>
				Response.json({
					clientId: 'discord-client',
					redirectUri: 'https://unbound.test/api/auth/callback/discord',
					scopes: ['identify', 'email'],
				}),
			POST: () => Response.json({ token: issuedToken, user: ALICE }),
		},
		'/api/v1/me': (request) => (ME_ANSWERS[bearer(request)] ?? ME_ANSWERS['token-revoked'])(),
		'/api/auth/sign-out': {
			POST: (request) => {
				revoked.push(bearer(request));

				return Response.json({ success: true });
			},
		},
	},
});

Object.assign(globalThis, { $$DEV$$: false });

const constants = await import('~/core/constants');

mock.module('~/core/constants', () => ({ ...constants, API_URL: server.url.origin }));
mock.module('~/account/discord-oauth', () => ({ authorizeWithDiscord: async () => 'code' }));

const account = await import('./api');

const signedOut: string[] = [];

account.on('signedOut', ({ account: { id } }) => void signedOut.push(id));

afterAll(() => {
	server.stop(true);
});

beforeEach(async () => {
	await account.signOut();
	revoked.length = 0;
	signedOut.length = 0;
	issuedToken = 'token-valid';
});

async function signInWith(token: string) {
	issuedToken = token;

	expect((await account.signIn()).status).toBe('signed-in');
	signedOut.length = 0;
}

test('signs in with Discord and keeps the account', async () => {
	const result = await account.signIn();

	expect(result).toEqual({
		status: 'signed-in',
		account: { id: 'user-alice', name: 'Alice', image: null },
	});
	expect(account.getAccount()).toEqual({ id: 'user-alice', name: 'Alice', image: null });
});

test('a 401 from an authenticated request signs the account out', async () => {
	await signInWith('token-revoked');

	const request = account.createClient()('GET /api/v1/me', { response: meResponseSchema });

	expect(
		await request.then(
			() => undefined,
			(cause: unknown) => cause,
		),
	).toMatchObject({
		status: 401,
	});
	expect(account.getAccount()).toBeUndefined();
	expect(signedOut).toEqual(['user-alice']);
});

test('refreshing saves the fresh profile, and a revoked session signs out', async () => {
	await signInWith('token-valid');
	await account.refresh();

	expect(account.getAccount()?.name).toBe('Alice Renamed');

	await signInWith('token-revoked');
	await account.refresh();

	expect(account.getAccount()).toBeUndefined();
	expect(signedOut).toEqual(['user-alice']);
});

test('a failure other than 401 keeps the session', async () => {
	await signInWith('token-down');
	await account.refresh();

	expect(account.getAccount()?.id).toBe('user-alice');
	expect(signedOut).toEqual([]);
});

test('signing out revokes the session on the server', async () => {
	await signInWith('token-valid');
	await account.signOut();

	expect(account.getAccount()).toBeUndefined();
	expect(revoked).toEqual(['token-valid']);
	expect(signedOut).toEqual(['user-alice']);
});
