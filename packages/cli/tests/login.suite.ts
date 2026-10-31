import {
	authRequest,
	createTestContext,
	meEndpoint,
	serveEndpoints,
	signInWithDiscord,
} from '@unbound-app/web/testing';
import { afterAll, afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { meResponseSchema } from '@unbound-app/contracts/account';
import { existsSync, statSync } from 'node:fs';

import type { DeviceCode } from '../src/lib/login';

import { getCredentialsPath, parseEnv } from '../src/lib/env';
import { createTempDir, runUbd } from './helpers/ubd';
import { createClient } from '../src/lib/api-client';
import { login } from '../src/lib/login';

const { ctx, close } = await createTestContext();
const server = serveEndpoints(ctx, { 'GET /api/v1/me': meEndpoint });
const config = createTempDir();
const env = parseEnv({ UNBOUND_API_URL: server.url.href, XDG_CONFIG_HOME: config.path });

afterEach(() => setSystemTime());

afterAll(async () => {
	await server.stop(true);
	config.remove();
	await close();
});

async function decide(
	decision: 'approve' | 'deny',
	code: DeviceCode | undefined,
	headers: Headers,
) {
	if (!code) {
		throw new Error('The login never showed a code.');
	}

	// The verification page claims the code for the signed-in user before it can be decided.
	await authRequest(ctx, `/device?user_code=${code.userCode}`, { headers });
	await authRequest(ctx, `/device/${decision}`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ userCode: code.userCode }),
	});
}

describe('ubd login and logout', () => {
	test('login polls until approved, stores a working session readable only by the user, and logout deletes it', async () => {
		const { userId, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678912',
			name: 'Publisher',
			email: 'publisher@example.com',
		});

		let shown: DeviceCode | undefined;
		let now = Date.now();
		const delays: number[] = [];

		const path = await login({
			env,
			prompt: (code) => {
				shown = code;
			},
			delay: async (ms) => {
				delays.push(ms);

				// The second wait is cut short so the poll comes too early and the server says slow_down.
				now += delays.length === 2 ? 1000 : ms;
				setSystemTime(new Date(now));

				if (delays.length === 3) {
					await decide('approve', shown, headers);
				}
			},
		});

		expect(delays).toEqual([5000, 5000, 10_000]);
		expect(shown?.verificationUriComplete).toContain(shown?.userCode ?? '');
		expect(path).toBe(getCredentialsPath(env));
		expect(statSync(path).mode & 0o777).toBe(0o600);

		const me = await createClient(env)('GET /api/v1/me', { response: meResponseSchema });

		expect(me.user.id).toBe(userId);

		const logout = await runUbd(['logout'], config.path, { XDG_CONFIG_HOME: config.path });

		expect(logout).toMatchObject({ exitCode: 0, stdout: `Logged out. Deleted ${path}.\n` });
		expect(existsSync(path)).toBe(false);
	});

	test('a denied login fails with the reason and stores nothing', async () => {
		const { headers } = await signInWithDiscord(ctx, {
			id: '80351110224678913',
			name: 'Denier',
			email: 'denier@example.com',
		});

		let shown: DeviceCode | undefined;
		let now = Date.now();

		const failure = await login({
			env,
			prompt: (code) => {
				shown = code;
			},
			delay: async (ms) => {
				now += ms;
				setSystemTime(new Date(now));
				await decide('deny', shown, headers);
			},
		}).then(
			() => 'logged in',
			(error: Error) => error.message,
		);

		expect(failure).toEndWith('(access_denied).');
		expect(existsSync(getCredentialsPath(env))).toBe(false);
	});
});
