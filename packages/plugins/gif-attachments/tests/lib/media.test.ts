import { describe, expect, test } from 'bun:test';

import { gifFile, gifMedia } from '~/lib/media';

describe('gif media', () => {
	test('prefers the GIF file, then the video, then a favorite', () => {
		const results = [
			{ url: 'https://klipy.com/gifs/a', src: 'https://x/a.mp4', gifSrc: 'https://x/a.gif' },
			{ url: 'https://klipy.com/gifs/b', src: 'https://x/b.mp4' },
		];
		const favorites = { 'https://tenor.com/view/c': { src: 'https://x/c.mp4' } };

		expect(gifMedia('https://klipy.com/gifs/a', results, favorites)).toBe('https://x/a.gif');
		expect(gifMedia('https://klipy.com/gifs/b', results, favorites)).toBe('https://x/b.mp4');
		expect(gifMedia('https://tenor.com/view/c', results, favorites)).toBe('https://x/c.mp4');
		expect(gifMedia('https://tenor.com/view/d', results, favorites)).toBeUndefined();
	});

	test('names the file after the link and types it by extension', () => {
		expect(gifFile('https://klipy.com/gifs/kpop-triples-405', 'https://x/y.mp4?w=1')).toEqual({
			url: 'https://x/y.mp4?w=1',
			filename: 'kpop-triples-405.mp4',
			mimeType: 'video/mp4',
		});
		expect(gifFile('https://tenor.com/view/x', 'https://media/abc')).toMatchObject({
			filename: 'x.gif',
			mimeType: 'image/gif',
		});
	});
});
