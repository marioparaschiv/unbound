import { describe, expect, test } from 'bun:test';

import {
	collectTenorResults,
	createTenorProvider,
	tenorToDiscordGif,
	tenorToTrending,
	type TenorResult,
} from '~/lib/tenor';

function result(id: string): TenorResult {
	return {
		id,
		title: '',
		h1_title: `Cat ${id}`,
		itemurl: `https://tenor.com/view/cat-${id}`,
		media: [
			{
				gif: {
					url: `https://media.tenor.com/${id}/a.gif`,
					preview: `https://media.tenor.com/${id}/p.png`,
				},
				tinymp4: {
					url: `https://media.tenor.com/${id}/a.mp4`,
					preview: `https://media.tenor.com/${id}/m.png`,
					dims: [220, 124],
				},
				tinywebm: {
					url: `https://media.tenor.com/${id}/a.webm`,
					preview: '',
					dims: [220, 124],
				},
			},
		],
	};
}

describe('tenorToDiscordGif', () => {
	test('maps a result to the picker GIF, in MP4 for mobile', () => {
		expect(tenorToDiscordGif(result('1'), 'mp4')).toEqual({
			id: '1',
			title: 'Cat 1',
			url: 'https://tenor.com/view/cat-1',
			gif_src: 'https://media.tenor.com/1/a.gif',
			src: 'https://media.tenor.com/1/a.mp4',
			width: 220,
			height: 124,
			preview: 'https://media.tenor.com/1/m.png',
		});
	});

	test('uses WebM when asked', () => {
		expect(tenorToDiscordGif(result('1'), 'webm')?.src).toBe(
			'https://media.tenor.com/1/a.webm',
		);
	});

	test('drops results without the format or a GIF', () => {
		expect(tenorToDiscordGif(result('1'), 'tinywebp')).toBeNull();
		expect(tenorToDiscordGif({ id: '2', itemurl: 'x', media: [] }, 'mp4')).toBeNull();
	});
});

describe('collectTenorResults', () => {
	test('follows the cursor and drops duplicates', async () => {
		const pages: Record<string, { next: string; results: TenorResult[] }> = {
			'': { next: 'a', results: [result('1'), result('2')] },
			a: { next: 'b', results: [result('2'), result('3')] },
			b: { next: 'c', results: [result('4')] },
		};
		const calls: string[] = [];
		const items = await collectTenorResults(async (pos) => {
			calls.push(pos);

			return pages[pos] ?? { next: '', results: [] };
		}, 4);

		expect(items.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
		expect(calls).toEqual(['', 'a', 'b']);
	});

	test('stops when a page adds nothing or the cursor repeats', async () => {
		const items = await collectTenorResults(
			async () => ({ next: 'same', results: [result('1')] }),
			10,
		);

		expect(items.map((item) => item.id)).toEqual(['1']);
	});
});

describe('tenorToTrending', () => {
	test('maps featured tags to categories', () => {
		expect(
			tenorToTrending({
				tags: [
					{ searchterm: 'happy', image: 'https://x/h.gif' },
					{ searchterm: 'broken' },
					{ searchterm: 'sad', image: 'https://x/s.gif' },
				],
			}),
		).toEqual({
			categories: [
				{ name: 'happy', src: 'https://x/h.gif' },
				{ name: 'sad', src: 'https://x/s.gif' },
			],
			gifs: [{ src: 'https://x/h.gif' }],
		});
	});

	test('returns null without categories', () => {
		expect(tenorToTrending(null)).toBeNull();
		expect(tenorToTrending({ tags: [] })).toBeNull();
	});
});

describe('createTenorProvider', () => {
	test('searches with the key, locale and query', async () => {
		const urls: string[] = [];
		const provider = createTenorProvider(async <T>(url: string) => {
			urls.push(url);

			return { next: '', results: [result('1')] } as T;
		});

		const gifs = await provider.search('cat', 1, { locale: 'en-US', mediaFormat: 'mp4' });
		const url = new URL(urls[0]!);

		expect(gifs).toHaveLength(1);
		expect(url.origin + url.pathname).toBe('https://api.tenor.com/v1/search');
		expect(url.searchParams.get('q')).toBe('cat');
		expect(url.searchParams.get('locale')).toBe('en_us');
		expect(url.searchParams.get('limit')).toBe('1');
		expect(url.searchParams.has('pos')).toBe(false);
		expect(url.searchParams.get('key')).toBeTruthy();
	});

	test('reads suggestions and registers shares', async () => {
		const urls: string[] = [];
		const provider = createTenorProvider(async <T>(url: string) => {
			urls.push(url);

			return { results: ['cats', 'cat meme'] } as T;
		});
		const context = { locale: 'en-US', mediaFormat: 'mp4' };

		expect(await provider.searchSuggestions('cat', context)).toEqual(['cats', 'cat meme']);

		await provider.registerShare('42', 'cat', context);

		const share = new URL(urls[1]!);

		expect(share.pathname).toBe('/v1/registershare');
		expect(share.searchParams.get('id')).toBe('42');
		expect(share.searchParams.get('q')).toBe('cat');
	});
});
