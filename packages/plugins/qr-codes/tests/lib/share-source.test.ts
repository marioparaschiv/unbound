import { describe, expect, test } from 'bun:test';

import { isWebLink, scannableImage } from '~/lib/share-source';

describe('scannableImage', () => {
	test('scans pictures through the media proxy and skips videos', () => {
		expect(
			scannableImage({ sourceURI: 'https://cdn.discordapp.com/attachments/1/2/a.png' }),
		).toBe('https://media.discordapp.net/attachments/1/2/a.png');
		expect(
			scannableImage({ uri: 'https://a/b.mp4', videoURI: 'https://a/b.mp4' }),
		).toBeUndefined();
	});
});

describe('isWebLink', () => {
	test('accepts only http and https links', () => {
		expect(isWebLink(' https://unbound.rip ')).toBe(true);
		expect(isWebLink('hello from unbound')).toBe(false);
	});
});
