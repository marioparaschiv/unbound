import { describe, expect, test } from 'bun:test';

import { avatarUrl, imageUrl } from '~/lib/sources';

describe('image sources', () => {
	test('asks for a small PNG avatar, or the default one', () => {
		expect(avatarUrl({ id: '1', avatar: 'abc' })).toBe(
			'https://cdn.discordapp.com/avatars/1/abc.png?size=128',
		);
		expect(avatarUrl({ id: '263689920210534400', avatar: null })).toMatch(
			/embed\/avatars\/\d\.png$/,
		);
	});

	test('uses the media proxy for the first image attachment', () => {
		expect(
			imageUrl([
				{ filename: 'a.txt', url: 'https://cdn.discordapp.com/a.txt' },
				{
					content_type: 'image/jpeg',
					proxy_url: 'https://media.discordapp.net/attachments/1/2/cat.jpg?ex=1',
				},
			]),
		).toBe(
			'https://media.discordapp.net/attachments/1/2/cat.jpg?ex=1&format=png&width=128&height=128',
		);
		expect(imageUrl([{ filename: 'a.txt', url: 'x' }])).toBeUndefined();
	});
});
