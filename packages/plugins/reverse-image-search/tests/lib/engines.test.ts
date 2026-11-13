import { describe, expect, test } from 'bun:test';

import { imageUrlOf, searchUrl } from '~/lib/engines';

describe('reverse image search', () => {
	test('builds each engine page with the image address encoded', () => {
		const image = 'https://cdn.discordapp.com/attachments/1/2/cat.png?ex=1&is=2';

		expect(searchUrl('google', image)).toBe(
			`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(image)}`,
		);
		expect(searchUrl('bing', image)).toStartWith(
			'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:https%3A%2F%2F',
		);
	});

	test('reads the first web address from the media source', () => {
		expect(imageUrlOf({ uri: 'https://media.discordapp.net/a.png' })).toBe(
			'https://media.discordapp.net/a.png',
		);
		expect(
			imageUrlOf({
				url: 'https://cdn.discordapp.com/a.png',
				uri: 'https://media.discordapp.net/a.png',
			}),
		).toBe('https://cdn.discordapp.com/a.png');
		expect(imageUrlOf({ uri: 'file:///tmp/a.png' })).toBeUndefined();
		expect(imageUrlOf(undefined)).toBeUndefined();
	});
});
