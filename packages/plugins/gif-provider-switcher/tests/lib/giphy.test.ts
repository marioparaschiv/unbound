import { describe, expect, test } from 'bun:test';

import {
	createGiphyProvider,
	giphyPages,
	giphyToDiscordGif,
	giphyToTrending,
	mergeGiphyPages,
	type GiphyResult,
} from '~/lib/giphy';

function result(id: string): GiphyResult {
	return {
		id,
		title: `Dog ${id}`,
		url: `https://giphy.com/gifs/dog-${id}`,
		images: {
			original: { url: `https://media.giphy.com/media/${id}/giphy.gif` },
			fixed_height: {
				url: `https://media.giphy.com/media/${id}/200.gif`,
				width: '356',
				height: '200',
				mp4: `https://media.giphy.com/media/${id}/200.mp4`,
				webp: `https://media.giphy.com/media/${id}/200.webp`,
			},
			fixed_height_still: { url: `https://media.giphy.com/media/${id}/200_s.gif` },
		},
	};
}

describe('giphyToDiscordGif', () => {
	test('maps a result to the picker GIF, in MP4 for mobile', () => {
		expect(giphyToDiscordGif(result('1'), 'mp4')).toEqual({
			id: '1',
			title: 'Dog 1',
			url: 'https://giphy.com/gifs/dog-1',
			gif_src: 'https://media.giphy.com/media/1/giphy.gif',
			src: 'https://media.giphy.com/media/1/200.mp4',
			width: 356,
			height: 200,
			preview: 'https://media.giphy.com/media/1/200_s.gif',
		});
	});

	test('uses WebP when asked and drops incomplete results', () => {
		expect(giphyToDiscordGif(result('1'), 'tinywebp')?.src).toBe(
			'https://media.giphy.com/media/1/200.webp',
		);
		expect(giphyToDiscordGif({ id: '2', url: 'x', images: {} }, 'mp4')).toBeNull();
	});
});

describe('giphy paging', () => {
	test('splits limits into pages of 50', () => {
		expect(giphyPages(100)).toEqual([
			{ offset: 0, limit: 50 },
			{ offset: 50, limit: 50 },
		]);
		expect(giphyPages(20)).toEqual([{ offset: 0, limit: 20 }]);
		expect(giphyPages(70)).toEqual([
			{ offset: 0, limit: 50 },
			{ offset: 50, limit: 20 },
		]);
	});

	test('merges pages without duplicates, up to the limit', () => {
		const merged = mergeGiphyPages(
			[
				[result('1'), result('2')],
				[result('2'), result('3')],
			],
			2,
		);

		expect(merged.map((item) => item.id)).toEqual(['1', '2']);
	});
});

describe('giphyToTrending', () => {
	test('maps categories with a GIF', () => {
		expect(
			giphyToTrending({ data: [{ name: 'actions', gif: result('1') }, { name: 'empty' }] }),
		).toEqual({
			categories: [{ name: 'actions', src: 'https://media.giphy.com/media/1/200.gif' }],
			gifs: [{ src: 'https://media.giphy.com/media/1/200.gif' }],
		});
		expect(giphyToTrending({ data: [] })).toBeNull();
	});
});

describe('createGiphyProvider', () => {
	test('searches every page with the key and language', async () => {
		const urls: URL[] = [];
		const provider = createGiphyProvider(async <T>(url: string) => {
			const parsed = new URL(url);

			urls.push(parsed);

			return { data: [result(parsed.searchParams.get('offset')!)] } as T;
		});

		const gifs = await provider.search('dog', 100, { locale: 'zh-TW', mediaFormat: 'mp4' });

		expect(gifs.map((gif) => gif.id)).toEqual(['0', '50']);
		expect(urls.map((url) => url.pathname)).toEqual(['/v1/gifs/search', '/v1/gifs/search']);
		expect(urls[0]!.searchParams.get('lang')).toBe('zh-TW');
		expect(urls[0]!.searchParams.get('q')).toBe('dog');
		expect(urls[0]!.searchParams.get('api_key')).toBeTruthy();
	});

	test('reads suggestion tag names', async () => {
		const provider = createGiphyProvider(
			async <T>() => ({ data: [{ name: 'dogs' }, { name: 'dog meme' }] }) as T,
		);

		expect(
			await provider.searchSuggestions('dog', { locale: 'en-US', mediaFormat: 'mp4' }),
		).toEqual(['dogs', 'dog meme']);
	});
});
