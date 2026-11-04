import { describe, expect, test } from 'bun:test';

import { pickGiphyFormat, pickTenorFormat } from '~/providers/formats';

describe('pickTenorFormat', () => {
	test('serves MP4 to mobile, which asks for mp4', () => {
		expect(pickTenorFormat('mp4')).toBe('tinymp4');
		expect(pickTenorFormat('')).toBe('tinymp4');
	});

	test('serves WebM and WebP when asked', () => {
		expect(pickTenorFormat('webm')).toBe('tinywebm');
		expect(pickTenorFormat('tinywebp')).toBe('webp');
	});
});

describe('pickGiphyFormat', () => {
	test('serves MP4 for anything but WebP, since Giphy has no WebM', () => {
		expect(pickGiphyFormat('mp4')).toBe('mp4');
		expect(pickGiphyFormat('webm')).toBe('mp4');
		expect(pickGiphyFormat('tinywebp')).toBe('webp');
	});
});
