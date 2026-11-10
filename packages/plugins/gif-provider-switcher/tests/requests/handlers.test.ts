import { describe, expect, test } from 'bun:test';

import { answerRoute, PASS_THROUGH, toErrorResponse, toResponse } from '~/requests/handlers';
import type { DiscordGif, GifProvider, TrendingData } from '~/types';

const context = { locale: 'en-US', mediaFormat: 'mp4' };

function gif(id: string): DiscordGif {
	return { id, title: id, url: id, src: id, gif_src: id, width: 1, height: 1, preview: id };
}

function fakeProvider(categories: TrendingData | null = null) {
	const calls: unknown[][] = [];
	const provider: GifProvider = {
		search: async (...args) => {
			calls.push(['search', ...args]);
			return [gif('s')];
		},
		searchSuggestions: async (...args) => {
			calls.push(['suggest', ...args]);
			return ['cats'];
		},
		getTrending: async (...args) => {
			calls.push(['trending', ...args]);
			return [gif('t')];
		},
		getCategories: async () => {
			calls.push(['categories']);
			return categories;
		},
		registerShare: async (...args) => {
			calls.push(['share', ...args]);
		},
	};

	return { provider, calls };
}

function memoryCache() {
	let value: TrendingData | undefined;

	return { get: () => value, set: (data: TrendingData) => void (value = data) };
}

describe('answerRoute', () => {
	test('searches with Vencord limits when Discord sends none', async () => {
		const { provider, calls } = fakeProvider();

		expect(
			await answerRoute({ kind: 'search', query: 'cat' }, provider, context, memoryCache()),
		).toEqual([gif('s')]);
		await answerRoute(
			{ kind: 'integration', integration: 'tenor', query: 'cat' },
			provider,
			context,
			memoryCache(),
		);
		await answerRoute({ kind: 'trending-gifs' }, provider, context, memoryCache());
		await answerRoute(
			{ kind: 'search', query: 'cat', limit: 10 },
			provider,
			context,
			memoryCache(),
		);

		expect(calls).toEqual([
			['search', 'cat', 100, context],
			['search', 'cat', 20, context],
			['trending', 50, context],
			['search', 'cat', 10, context],
		]);
	});

	test('answers suggestions and selects', async () => {
		const { provider, calls } = fakeProvider();

		expect(
			await answerRoute({ kind: 'suggest', query: 'ca' }, provider, context, memoryCache()),
		).toEqual(['cats']);
		expect(
			await answerRoute(
				{ kind: 'select', id: '1', query: 'cat' },
				provider,
				context,
				memoryCache(),
			),
		).toBeNull();
		expect(calls).toContainEqual(['share', '1', 'cat', context]);
	});

	test('caches trending categories', async () => {
		const data = { categories: [{ name: 'happy', src: 'h' }], gifs: [{ src: 'h' }] };
		const { provider, calls } = fakeProvider(data);
		const cache = memoryCache();

		expect(await answerRoute({ kind: 'trending' }, provider, context, cache)).toEqual(data);
		expect(await answerRoute({ kind: 'trending' }, provider, context, cache)).toEqual(data);
		expect(calls.filter(([name]) => name === 'categories')).toHaveLength(1);
	});

	test("falls back to Discord's trending when the provider has no categories", async () => {
		const { provider } = fakeProvider(null);

		expect(await answerRoute({ kind: 'trending' }, provider, context, memoryCache())).toBe(
			PASS_THROUGH,
		);
	});
});

describe('responses', () => {
	test('wraps bodies as Discord HTTP responses', () => {
		expect(toResponse(['a'])).toEqual({
			ok: true,
			status: 200,
			headers: {},
			body: ['a'],
			text: '["a"]',
		});
		expect(toResponse(null)).toMatchObject({ ok: true, status: 204, body: null });
	});

	test('wraps errors as failed responses', () => {
		expect(toErrorResponse(new Error('down'))).toMatchObject({
			ok: false,
			status: 502,
			body: { message: 'down' },
		});
	});
});
