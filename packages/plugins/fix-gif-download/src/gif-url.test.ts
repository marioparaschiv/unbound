import { describe, expect, test } from 'bun:test';

import { getPreferredGifUrl, isGifSource } from './gif-url';

describe('getPreferredGifUrl', () => {
	test('prefers a retained GIF over the video Discord plays', () => {
		const media = {
			mediaUrl: 'https://media.tenor.com/abc123/AAAAC/example.mp4',
			sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.gif',
			contentType: 'video/mp4',
		};

		expect(isGifSource(media)).toBe(true);
		expect(getPreferredGifUrl(media)).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
	});

	test('prefers a direct GIF in a later key over a GIF derived from an earlier video', () => {
		const media = {
			sourceURI: 'https://static.klipy.com/ii/example/video.mp4',
			url: 'https://static.klipy.com/ii/example/animation.gif',
		};

		expect(getPreferredGifUrl(media)).toBe('https://static.klipy.com/ii/example/animation.gif');
	});

	test('derives the GIF from a Tenor video URL', () => {
		expect(getPreferredGifUrl('https://media.tenor.com/abc123/AAAAC/example.mp4')).toBe(
			'https://media.tenor.com/abc123/AAAAC/example.gif',
		);
		expect(
			getPreferredGifUrl({
				sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.mp4',
				width: 320,
			}),
		).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
	});

	test('normalizes Giphy page and media URLs', () => {
		expect(getPreferredGifUrl('https://giphy.com/gifs/reaction-cat-abc123')).toBe(
			'https://media.giphy.com/media/abc123/giphy.gif',
		);
		expect(getPreferredGifUrl('https://media.giphy.com/media/abc123/giphy.mp4')).toBe(
			'https://media.giphy.com/media/abc123/giphy.gif',
		);
	});

	test('appends .gif to a Tenor page URL, as Discord does', () => {
		expect(getPreferredGifUrl('https://tenor.com/view/funny-cat-gif-123456')).toBe(
			'https://tenor.com/view/funny-cat-gif-123456.gif',
		);
	});

	test('switches Discord’s animated proxy format to GIF', () => {
		expect(
			getPreferredGifUrl(
				'https://media.discordapp.net/attachments/1/2/reaction.gif?format=webp&animated=true&width=320',
			),
		).toBe(
			'https://media.discordapp.net/attachments/1/2/reaction.gif?format=gif&animated=true&width=320',
		);
	});

	test('unwraps Discord external proxies to the GIF they wrap', () => {
		expect(
			getPreferredGifUrl(
				'https://images-ext-1.discordapp.net/external/example/https/static.klipy.com/ii/example.gif',
			),
		).toBe('https://static.klipy.com/ii/example.gif');
		expect(
			getPreferredGifUrl(
				'https://images-ext-1.discordapp.net/external/example/https/media.tenor.com/abc123/AAAAC/example.mp4',
			),
		).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
	});

	test('leaves Klipy video to the Klipy API, since its GIF path cannot be derived', () => {
		expect(
			getPreferredGifUrl({
				providerName: 'Klipy',
				mediaUrl: 'https://static.klipy.com/media/abc123/example.mp4',
			}),
		).toBeNull();
		expect(
			getPreferredGifUrl(
				'https://images-ext-1.discordapp.net/external/example/https/static.klipy.com/ii/example.mp4',
			),
		).toBeNull();
	});
});

describe('isGifSource', () => {
	test('recognizes GIF provider video, GIF content types and nested GIF media', () => {
		expect(isGifSource({ providerName: 'Klipy', mediaUrl: 'https://x.test/a.mp4' })).toBe(true);
		expect(isGifSource('https://x.test/a.mp4', 'image/gif')).toBe(true);
		expect(isGifSource({ media: { mimeType: 'image/gif' } })).toBe(true);
		expect(isGifSource('https://media.tenor.com/abc/example.mp4')).toBe(true);
	});

	test('rejects ordinary video', () => {
		expect(
			isGifSource('https://cdn.discordapp.com/attachments/1/2/clip.mp4', 'video/mp4'),
		).toBe(false);
		expect(isGifSource({ url: 'https://example.com/clip.mp4' })).toBe(false);
	});
});
