import { describe, expect, test } from 'bun:test';

import { asFavoritableSource, isVideoSource, type MediaSource } from '~/lib/media-source';

describe('media sources', () => {
	test('recognizes videos by their content type', () => {
		expect(isVideoSource({ contentType: 'video/mp4' })).toBe(true);
		expect(isVideoSource({ contentType: 'image/png' })).toBe(false);
		expect(isVideoSource({})).toBe(false);
	});

	test('favorites a video as a GIFV from its file URL', () => {
		const video: MediaSource = {
			contentType: 'video/mp4',
			sourceURI: 'https://cdn/a.mp4',
			uri: 'https://media/a.mp4',
		};

		expect(asFavoritableSource(video)).toEqual({
			contentType: 'video/mp4',
			sourceURI: 'https://cdn/a.mp4',
			uri: 'https://media/a.mp4',
			isGIFV: true,
			embedURI: 'https://cdn/a.mp4',
		});
	});

	test('leaves images and GIFVs as they are', () => {
		const image = { contentType: 'image/png', uri: 'https://media/a.png' };
		const gifv = { contentType: 'video/mp4', isGIFV: true, embedURI: 'https://tenor/a' };

		expect(asFavoritableSource(image)).toBe(image);
		expect(asFavoritableSource(gifv)).toBe(gifv);
	});
});
