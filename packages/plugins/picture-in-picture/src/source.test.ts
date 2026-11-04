import { describe, expect, test } from 'bun:test';

import { isVideoSource, mediaKey, playerKind, sourceKeys, videoKey } from '~/source';

describe('mediaKey', () => {
	test('gives the CDN and media proxy copies of one attachment the same key', () => {
		const cdn = 'https://cdn.discordapp.com/attachments/1/2/clip.mp4?ex=a&is=b&hm=c';
		const proxy = 'https://media.discordapp.net/attachments/1/2/clip.mp4?width=400';

		expect(mediaKey(cdn)).toBe('/attachments/1/2/clip.mp4');
		expect(mediaKey(proxy)).toBe(mediaKey(cdn));
	});

	test('keeps the host of other sites', () => {
		expect(mediaKey('https://Example.com/v/clip.mp4?t=1')).toBe('example.com/v/clip.mp4');
	});

	test('keeps a value that is not an address as it is, and ignores what is not text', () => {
		expect(mediaKey('file-name')).toBe('file-name');
		expect(mediaKey('')).toBeUndefined();
		expect(mediaKey(42)).toBeUndefined();
		expect(mediaKey(undefined)).toBeUndefined();
	});
});

describe('sourceKeys', () => {
	test('collects distinct keys from every address of a source', () => {
		expect(
			sourceKeys({
				videoURI: 'https://cdn.discordapp.com/attachments/1/2/clip.mp4',
				uri: 'https://media.discordapp.net/attachments/1/2/clip.mp4?format=webp',
				sourceURI: 'https://cdn.discordapp.com/attachments/1/2/clip.mp4?ex=1',
				embedURI: 'https://youtube.com/watch',
			}),
		).toEqual(['/attachments/1/2/clip.mp4', 'youtube.com/watch']);
	});

	test('has no keys without a source', () => {
		expect(sourceKeys(undefined)).toEqual([]);
	});
});

describe('isVideoSource', () => {
	test('treats a video address, a GIF video and a video file as videos', () => {
		expect(isVideoSource({ videoURI: 'https://cdn.discordapp.com/a.mp4' })).toBe(true);
		expect(isVideoSource({ isGIFV: true, uri: 'https://tenor.com/x' })).toBe(true);
		expect(isVideoSource({ uri: 'https://cdn.discordapp.com/attachments/1/2/a.MOV?x=1' })).toBe(
			true,
		);
	});

	test('treats images and missing sources as not videos', () => {
		expect(isVideoSource({ uri: 'https://cdn.discordapp.com/attachments/1/2/a.png' })).toBe(
			false,
		);
		expect(isVideoSource({ videoURI: '' })).toBe(false);
		expect(isVideoSource(undefined)).toBe(false);
	});
});

describe('playerKind', () => {
	test('plays attachments and video embeds natively', () => {
		expect(
			playerKind({
				videoURI: 'https://media.discordapp.net/attachments/1/2/a.mov',
				embedURI: 'https://cdn.discordapp.com/attachments/1/2/a.mov',
			}),
		).toBe('video');
	});

	test('plays YouTube and other iframe embeds in a web player', () => {
		const youtube = {
			uri: 'https://www.youtube.com/embed/jNQXAC9IVRw',
			embedURI: 'https://www.youtube.com/embed/jNQXAC9IVRw',
		};

		expect(playerKind(youtube)).toBe('web');
		expect(videoKey(youtube)).toBe('www.youtube.com/embed/jNQXAC9IVRw');
	});

	test('ignores images', () => {
		const image = { uri: 'https://media.discordapp.net/attachments/1/2/a.png' };

		expect(playerKind(image)).toBeUndefined();
		expect(videoKey(image)).toBeUndefined();
	});
});
