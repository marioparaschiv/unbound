import { expect, test } from 'bun:test';

import { getPreferredGifUrl, isGifSource, rewriteGifMedia } from '@fix-gif-download/media';

test('recognizes a GIF source hidden behind Discord video media', () => {
	const media = {
		mediaUrl: 'https://media.tenor.com/abc123/AAAAC/example.mp4',
		sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.gif',
		contentType: 'video/mp4',
	};

	expect(isGifSource(media)).toBe(true);
	expect(getPreferredGifUrl(media)).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
	expect(rewriteGifMedia(media, media.contentType)).toEqual({
		source: {
			...media,
			sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.gif',
			contentType: 'image/gif',
		},
		contentType: 'image/gif',
	});
});

test('converts a Tenor video URL when no original URI is retained', () => {
	const url = 'https://media.tenor.com/abc123/AAAAC/example.mp4';

	expect(getPreferredGifUrl(url)).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
});

test('preserves Klipy video media while marking it as a GIF download', () => {
	const media = {
		providerName: 'Klipy',
		mediaUrl: 'https://static.klipy.com/media/abc123/example.mp4',
	};

	expect(isGifSource(media)).toBe(true);
	expect(getPreferredGifUrl(media)).toBeNull();
	expect(rewriteGifMedia(media, 'video/mp4')).toEqual({
		source: media,
		contentType: 'image/gif',
	});
});

test('preserves Discord external Klipy proxies because their path is signed', () => {
	const url =
		'https://images-ext-1.discordapp.net/external/example/https/static.klipy.com/ii/example.mp4';

	expect(getPreferredGifUrl(url)).toBeNull();
	expect(rewriteGifMedia(url, 'video/mp4')).toEqual({
		source: url,
		contentType: 'image/gif',
	});
});

test('normalizes Giphy page and media URLs', () => {
	expect(getPreferredGifUrl('https://giphy.com/gifs/reaction-cat-abc123')).toBe(
		'https://media.giphy.com/media/abc123/giphy.gif',
	);
	expect(getPreferredGifUrl('https://media.giphy.com/media/abc123/giphy.mp4')).toBe(
		'https://media.giphy.com/media/abc123/giphy.gif',
	);
});

test('normalizes a Tenor page URL using Discord’s GIF conversion behavior', () => {
	expect(getPreferredGifUrl('https://tenor.com/view/funny-cat-gif-123456')).toBe(
		'https://tenor.com/view/funny-cat-gif-123456.gif',
	);
});

test('keeps Discord media source metadata while switching the source URI', () => {
	const source = {
		sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.mp4',
		width: 320,
		height: 180,
	};

	const rewritten = rewriteGifMedia(source, 'video/mp4');

	expect(rewritten).toEqual({
		source: {
			sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.gif',
			contentType: 'image/gif',
			width: 320,
			height: 180,
		},
		contentType: 'image/gif',
	});
});

test('prefers a retained direct GIF over a derived video URL', () => {
	const media = {
		sourceURI: 'https://static.klipy.com/ii/example/video.mp4',
		url: 'https://static.klipy.com/ii/example/animation.gif',
	};

	expect(getPreferredGifUrl(media)).toBe('https://static.klipy.com/ii/example/animation.gif');
});

test('normalizes Discord’s animated proxy format to GIF', () => {
	const url =
		'https://media.discordapp.net/attachments/1/2/reaction.gif?format=webp&animated=true&width=320';

	expect(getPreferredGifUrl(url)).toBe(
		'https://media.discordapp.net/attachments/1/2/reaction.gif?format=gif&animated=true&width=320',
	);
});

test('keeps string GIF sources primitive for the native media method', () => {
	const url =
		'https://images-ext-1.discordapp.net/external/example/https/static.klipy.com/ii/example.gif';

	expect(rewriteGifMedia(url, 'image/gif')).toEqual({
		source: 'https://static.klipy.com/ii/example.gif',
		contentType: 'image/gif',
	});
});

test('unwraps Discord external GIF proxies for native fetching', () => {
	const url =
		'https://images-ext-1.discordapp.net/external/example/https/static.klipy.com/ii/example.gif';

	expect(getPreferredGifUrl(url)).toBe('https://static.klipy.com/ii/example.gif');
});

test('unwraps signed Discord Tenor proxies to a valid direct GIF', () => {
	const url =
		'https://images-ext-1.discordapp.net/external/example/https/media.tenor.com/abc123/AAAAC/example.mp4';

	expect(getPreferredGifUrl(url)).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
});
