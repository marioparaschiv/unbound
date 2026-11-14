import { describe, expect, test } from 'bun:test';

import { copyableImage } from '~/lib/share-source';
import { toBase64 } from '~/lib/base64';
import { pngUrl } from '~/lib/png-url';

describe('pngUrl', () => {
	test('asks the media proxy for a PNG of an attachment', () => {
		expect(pngUrl('https://cdn.discordapp.com/attachments/1/2/cat.webp?ex=a&is=b')).toBe(
			'https://media.discordapp.net/attachments/1/2/cat.webp?ex=a&is=b&format=png',
		);
		expect(pngUrl('https://media.discordapp.net/attachments/1/2/cat.jpg?format=webp')).toBe(
			'https://media.discordapp.net/attachments/1/2/cat.jpg?format=png',
		);
	});

	test('leaves other hosts and unreadable URLs alone', () => {
		expect(pngUrl('https://example.com/cat.webp')).toBe('https://example.com/cat.webp');
		expect(pngUrl('not a url')).toBe('not a url');
	});
});

describe('copyableImage', () => {
	test('copies pictures, preferring the full-size source', () => {
		expect(copyableImage({ uri: 'https://a/small.png', sourceURI: 'https://a/full.png' })).toBe(
			'https://a/full.png',
		);
		expect(copyableImage({ uri: 'https://a/only.png' })).toBe('https://a/only.png');
	});

	test('skips videos and items without an https image', () => {
		expect(
			copyableImage({ uri: 'https://a/p.png', videoURI: 'https://a/v.mp4' }),
		).toBeUndefined();
		expect(copyableImage({ uri: 'file:///local.png' })).toBeUndefined();
		expect(copyableImage(undefined)).toBeUndefined();
	});
});

describe('toBase64', () => {
	test('encodes bytes', () => {
		expect(toBase64(new TextEncoder().encode('hello').buffer as ArrayBuffer)).toBe('aGVsbG8=');
	});
});
