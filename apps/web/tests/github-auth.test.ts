import { afterAll, afterEach, expect, spyOn, test } from 'bun:test';

import { createGitHubClient } from '~/lib/github';
import { parseEnv } from '~/lib/env';

import { OFFLINE_DATABASE_ENV, TEST_ENV } from './helpers/context';

const APP_CREDENTIALS = `Basic ${btoa(`${TEST_ENV.GITHUB_CLIENT_ID}:${TEST_ENV.GITHUB_CLIENT_SECRET}`)}`;

const { preconnect } = globalThis.fetch;
const fetchSpy = spyOn(globalThis, 'fetch');

afterEach(() => {
	fetchSpy.mockReset();
});

afterAll(() => {
	fetchSpy.mockRestore();
});

// Captures the authorization header of the one request `getRepository` sends.
async function sentAuthorization(apiUrl: string, token: string | null) {
	let authorization: string | null = 'not sent';

	async function capture(_input: RequestInfo | URL, init?: RequestInit) {
		authorization = new Headers(init?.headers).get('authorization');

		return new Response(null, { status: 404 });
	}

	fetchSpy.mockImplementation(Object.assign(capture, { preconnect }));

	const env = parseEnv({ ...TEST_ENV, ...OFFLINE_DATABASE_ENV, GITHUB_API_URL: apiUrl });

	await createGitHubClient(env, token)
		.getRepository('acme/addons')
		.catch(() => undefined);

	return authorization;
}

test("a user's token wins over the app credentials", async () => {
	expect(await sentAuthorization('https://api.github.com', 'user-token')).toBe(
		'Bearer user-token',
	);
});

test('a read without a user token authenticates as the OAuth app on api.github.com', async () => {
	expect(await sentAuthorization('https://api.github.com', null)).toBe(APP_CREDENTIALS);
});

test('the app credentials never go to another host', async () => {
	for (const apiUrl of [
		'http://127.0.0.1:4311',
		'http://api.github.com',
		'https://api.github.com.evil.example',
		'https://github.example.com/api/v3/',
	]) {
		expect(await sentAuthorization(apiUrl, null)).toBeNull();
	}
});
