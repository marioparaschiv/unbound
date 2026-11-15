import { describe, expect, test } from 'bun:test';

import { readableImage } from '~/lib/image-url';

describe('readableImage', () => {
	test('reads pictures through the media proxy', () => {
		expect(
			readableImage({ sourceURI: 'https://cdn.discordapp.com/attachments/1/2/a.png?ex=1' }),
		).toBe('https://media.discordapp.net/attachments/1/2/a.png?ex=1');
		expect(readableImage({ uri: 'https://example.com/a.jpg' })).toBe(
			'https://example.com/a.jpg',
		);
	});

	test('skips videos and items without a web address', () => {
		expect(
			readableImage({ uri: 'https://a/b.mp4', videoURI: 'https://a/b.mp4' }),
		).toBeUndefined();
		expect(readableImage({ uri: 'file:///a.png' })).toBeUndefined();
		expect(readableImage(undefined)).toBeUndefined();
	});
});
