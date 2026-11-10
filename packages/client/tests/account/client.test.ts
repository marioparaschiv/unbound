import { afterAll, expect, test } from 'bun:test';

import { createUnboundClient } from '~/account/client';

const seen: (string | null)[] = [];

const server = Bun.serve({
	port: 0,
	routes: {
		'/api/v1/users/:id/badges': (request) => {
			seen.push(request.headers.get('authorization'));

			return Response.json({ badges: [] });
		},
	},
});

afterAll(() => {
	server.stop(true);
});

test('sends the session token only when given one', async () => {
	const baseUrl = server.url.origin;

	await createUnboundClient({ baseUrl })('GET /api/v1/users/$id/badges', {
		params: { id: 'user-alice' },
	});
	await createUnboundClient({ baseUrl, token: 'token-valid' })('GET /api/v1/users/$id/badges', {
		params: { id: 'user-alice' },
	});

	expect(seen).toEqual([null, 'Bearer token-valid']);
});
