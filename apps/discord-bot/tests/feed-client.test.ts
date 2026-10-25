import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { API_KEY_HEADER, createFeedClient } from '~/lib/feed/client';

import { SAMPLE_PAGES } from './helpers/feeds';

type Request = { path: string; query: Record<string, string>; apiKey: string | null };

describe('fetchFeedPage', () => {
	const requests: Request[] = [];
	let server: ReturnType<typeof Bun.serve>;

	beforeAll(() => {
		server = Bun.serve({
			port: 0,
			fetch(request) {
				const url = new URL(request.url);

				requests.push({
					path: url.pathname,
					query: Object.fromEntries(url.searchParams),
					apiKey: request.headers.get(API_KEY_HEADER),
				});

				if (url.pathname.endsWith('/members')) {
					return new Response('nope', { status: 401 });
				}

				if (url.pathname.endsWith('/addons')) {
					return Response.json({
						items: [{ id: 'addon-1' }],
						cursor: 'c',
						hasMore: false,
					});
				}

				return Response.json(SAMPLE_PAGES.releases);
			},
		});
	});

	afterAll(async () => {
		await server.stop(true);
	});

	test('requests the feed with the cursor, limit and API key and returns the page', async () => {
		const fetchFeedPage = createFeedClient(server.url.origin, 'secret');

		expect(await fetchFeedPage('releases', 'c1', 50)).toEqual(SAMPLE_PAGES.releases);
		await fetchFeedPage('releases', null, 100);

		expect(requests).toEqual([
			{ path: '/api/v1/bot/releases', query: { after: 'c1', limit: '50' }, apiKey: 'secret' },
			{ path: '/api/v1/bot/releases', query: { limit: '100' }, apiKey: 'secret' },
		]);
	});

	test('throws on a non-2xx response, naming the feed and status', async () => {
		const fetchFeedPage = createFeedClient(server.url.origin, 'secret');

		const message = await fetchFeedPage('members', null, 100).then(
			() => 'resolved',
			(error: Error) => error.message,
		);

		expect(message).toMatch(/members.*401/);
	});

	test('throws on a page that breaks the feed contract, naming the feed', async () => {
		const fetchFeedPage = createFeedClient(server.url.origin, 'secret');

		const message = await fetchFeedPage('addons', null, 100).then(
			() => 'resolved',
			(error: Error) => error.message,
		);

		expect(message).toContain('Feed addons returned a page that does not match its contract');
	});
});
