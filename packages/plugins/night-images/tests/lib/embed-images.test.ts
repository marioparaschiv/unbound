import { describe, expect, test } from 'bun:test';

import { brightEmbedMessages } from '~/lib/embed-images';

const isBright = (placeholder: string | null | undefined) => placeholder === 'bright';

describe('brightEmbedMessages', () => {
	test('finds messages whose embed image, thumbnail or gallery image is bright', () => {
		const messages = [
			{ id: 'image', embeds: [{ image: { url: 'a', placeholder: 'bright' } }] },
			{ id: 'thumbnail', embeds: [{ thumbnail: { url: 'b', placeholder: 'bright' } }] },
			{
				id: 'gallery',
				embeds: [
					{
						images: [
							{ url: 'c', placeholder: 'dark' },
							{ url: 'd', placeholder: 'bright' },
						],
					},
				],
			},
			{ id: 'dark', embeds: [{ image: { url: 'e', placeholder: 'dark' } }] },
			{ id: 'text', embeds: [{}] },
			{ id: 'none' },
		];

		expect(brightEmbedMessages(messages, isBright)).toEqual(['image', 'thumbnail', 'gallery']);
	});

	test('skips images without a URL', () => {
		expect(
			brightEmbedMessages(
				[{ id: 'm', embeds: [{ image: { placeholder: 'bright' } }] }],
				isBright,
			),
		).toEqual([]);
	});
});
