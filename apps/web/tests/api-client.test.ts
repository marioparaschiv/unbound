import { meResponseSchema } from '@unbound-app/contracts/account';
import { afterAll, describe, expect, test } from 'bun:test';

import { ApiRequestError, createApiClient } from '~/api/client';
import type { Api } from '~/api';
import me from '~/endpoints/me';

import { createTestContext, signInWithDiscord } from './helpers/context';

const { ctx, close } = await createTestContext();
const server = Bun.serve({ port: 0, fetch: (request) => me.handle(ctx, request) });

afterAll(async () => {
	await server.stop(true);
	await close();
});

describe('createApiClient', () => {
	test('sends the configured credentials and parses the response with the contract', async () => {
		const { userId, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678915',
			name: 'Client',
			email: 'client@example.com',
		});

		const request = createApiClient<Api>({ baseUrl: server.url.href, headers });
		const result = await request('GET /api/v1/me', { response: meResponseSchema });

		expect(result.user).toEqual({ id: userId, name: 'Client', image: null, role: 'user' });
	});

	test('throws the contract error code from an error response', async () => {
		const request = createApiClient<Api>({ baseUrl: server.url.href });
		const error = await request('GET /api/v1/me', { response: meResponseSchema }).catch(
			(cause: unknown) => cause,
		);

		expect(error).toBeInstanceOf(ApiRequestError);
		expect(error).toMatchObject({ code: 'unauthorized', status: 401 });
	});
});
