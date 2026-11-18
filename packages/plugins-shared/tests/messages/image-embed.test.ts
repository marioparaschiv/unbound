import { describe, expect, test } from 'bun:test';

import { withImages } from '~/messages/image-embed';

const image = { url: 'https://example.com/a.png', width: 4, height: 2 };

describe('withImages', () => {
	test('adds an image embed after the existing ones', () => {
		expect(withImages([{ url: 'https://other' }], [image])).toEqual([
			{ url: 'https://other' },
			{ type: 'image', url: image.url, thumbnail: { ...image, proxy_url: image.url } },
		]);
	});

	test('skips images an embed already shows', () => {
		expect(withImages([{ url: image.url }], [image])).toEqual([{ url: image.url }]);
	});
});
