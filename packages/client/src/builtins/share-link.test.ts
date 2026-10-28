import { describe, expect, test } from 'bun:test';

import { parseShareLink } from './share-link';

function extensionLink(paths: string[], scheme = 'discord') {
	const query = paths
		.map((path) => {
			const fileURL = encodeURI(`file://${path}`);
			const fromExtension = encodeURIComponent(fileURL);

			return `url=${encodeURIComponent(fromExtension)}`;
		})
		.join('&');

	return `${scheme}://share?${query}`;
}

describe('share links', () => {
	test('reads every file the extension sends, decoding its double encoding', () => {
		const files = parseShareLink(
			extensionLink(['/private/var/mobile/tmp/a b.png', '/var/mobile/Media/clip.MOV']),
		);

		expect(files).toEqual([
			{
				uri: 'file:///private/var/mobile/tmp/a%20b.png',
				path: '/private/var/mobile/tmp/a b.png',
				filename: 'a b.png',
				mimeType: 'image/png',
			},
			{
				uri: 'file:///var/mobile/Media/clip.MOV',
				path: '/var/mobile/Media/clip.MOV',
				filename: 'clip.MOV',
				mimeType: 'video/quicktime',
			},
		]);
	});

	test('accepts the unbound scheme and single encoding', () => {
		expect(parseShareLink('unbound://share?url=file%3A%2F%2F%2Ftmp%2Fdoc.pdf')).toEqual([
			{
				uri: 'file:///tmp/doc.pdf',
				path: '/tmp/doc.pdf',
				filename: 'doc.pdf',
				mimeType: 'application/pdf',
			},
		]);
	});

	test('ignores other links and anything that is not a local file', () => {
		expect(parseShareLink('discord://channels/1/2')).toBeUndefined();
		expect(parseShareLink('https://discord.com/share?url=file:///tmp/a.png')).toBeUndefined();
		expect(
			parseShareLink(
				'discord://share?url=https%3A%2F%2Fexample.com%2Fa.png&url=file%3A%2F%2F%2Ftmp%2F..%2Fetc%2Fpasswd&url=file%3A%2F%2F%2Ftmp%2F&name=x',
			),
		).toEqual([]);
		expect(parseShareLink('discord://share')).toEqual([]);
	});

	test('drops duplicates and stops at ten files', () => {
		const paths = Array.from({ length: 12 }, (_, index) => `/tmp/${index}.jpg`);
		const files = parseShareLink(extensionLink(['/tmp/0.jpg', ...paths]));

		expect(files?.map((file) => file.filename)).toEqual(
			paths.slice(0, 10).map((path) => path.slice(5)),
		);
	});
});
