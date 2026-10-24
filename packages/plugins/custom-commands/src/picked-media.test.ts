import { expect, test } from 'bun:test';

import { resolvePickedMedia } from './picked-media';

test('accepts local image metadata supplied by the platform picker', () => {
	expect(
		resolvePickedMedia({
			uri: 'file:///Documents/tmp/photo.png',
			mimeType: 'image/png',
			fileSize: 193309,
			width: 750,
			height: 1334,
		}),
	).toMatchObject({
		fileName: 'photo.png',
		fileSize: 193309,
		type: 'image/png',
		width: 750,
		height: 1334,
	});
});

test('derives the MIME type from the file extension when the picker omits it', () => {
	expect(
		resolvePickedMedia({ uri: 'file:///Documents/tmp/clip.mov', fileSize: 8192 }),
	).toMatchObject({ fileName: 'clip.mov', fileSize: 8192, type: 'video/quicktime' });
});

test('rejects picker results without usable local file metadata', () => {
	expect(() =>
		resolvePickedMedia({ uri: 'file:///Documents/tmp/photo.png', mimeType: 'image/png' }),
	).toThrow('file size');
	expect(() => resolvePickedMedia({ uri: 'https://cdn.example/photo.png', fileSize: 1 })).toThrow(
		'unavailable',
	);
	expect(() =>
		resolvePickedMedia({ uri: 'file:///Documents/tmp/notes.txt', fileSize: 1 }),
	).toThrow('image or video');
});
