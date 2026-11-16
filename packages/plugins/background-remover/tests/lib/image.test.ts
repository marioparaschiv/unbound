import { describe, expect, test } from 'bun:test';

import { cutoutName, imageOf } from '~/lib/image';

describe('images', () => {
	test('finds the first still image', () => {
		expect(
			imageOf([
				{ url: 'a', content_type: 'image/gif', filename: 'a.gif' },
				{ url: 'b', filename: 'b.JPG' },
			])?.url,
		).toBe('b');
		expect(imageOf([{ url: 'c', filename: 'c.mp4' }])).toBeUndefined();
	});

	test('names the cutout after the image', () => {
		expect(cutoutName('cat.jpg')).toBe('cat-cutout.png');
		expect(cutoutName(undefined)).toBe('image-cutout.png');
	});
});
