import { ComponentType, MessageFlags } from 'discord.js';
import { describe, expect, test } from 'bun:test';

import { renderStarPost, starAccent, starEmoji, type StarredMessage } from '~/lib/star-post';

const MESSAGE: StarredMessage = {
	channelId: '950850316318933004',
	url: 'https://discord.com/channels/1/950850316318933004/3',
	createdAt: new Date('2025-04-11T02:32:06.000Z'),
	author: { name: 'Sky.Bit', emoji: { name: 'sb_1_abc', id: '42' } },
	content: 'Petition to make one of these images a server emoji <@1>',
	media: [{ url: 'https://cdn.discordapp.com/a.png', spoiler: true }],
	files: [{ name: 'log.txt', url: 'https://cdn.discordapp.com/log.txt' }],
};

describe('starEmoji', () => {
	test('follows the accent from 2 stars to the gold at 8', () => {
		expect([0, 2, 5, 7, 8, 42].map((stars) => starEmoji(stars).name)).toEqual([
			'mb_star_2',
			'mb_star_2',
			'mb_star_5',
			'mb_star_7',
			'mb_star_8',
			'mb_star_8',
		]);
	});
});

describe('starAccent', () => {
	// Carl-bot's cream at 2 stars and its gold, reached at 8 instead of 13.
	test.each([
		[0, 0xff_ef_c0],
		[2, 0xff_ef_c0],
		[8, 0xff_c2_0c],
		[42, 0xff_c2_0c],
	])('is %i stars to its colour', (stars, colour) => {
		expect(starAccent(stars)).toBe(colour);
	});
});

describe('renderStarPost', () => {
	const { body } = renderStarPost(MESSAGE, 15);
	const [container, row] = body.components;

	test('is a components v2 card that pings no one', () => {
		expect(body.flags).toBe(MessageFlags.IsComponentsV2);
		expect(body.allowed_mentions).toEqual({ parse: [] });
		expect(container.accent_color).toBe(starAccent(15));
	});

	test('shows the author and stars, content, media, files and time, then the jump button under the card', () => {
		expect(container.components.map((component) => component.type)).toEqual([
			ComponentType.TextDisplay,
			ComponentType.MediaGallery,
			ComponentType.TextDisplay,
			ComponentType.TextDisplay,
		]);
		expect(row.components[0]?.url).toBe(MESSAGE.url);

		const text = JSON.stringify(container);

		expect(text).toContain(
			'<:sb_1_abc:42> **Sky.Bit** · <:mb_star_8:1571500057344352366> **15**\\nPetition',
		);
		expect(text).toContain('"spoiler":true');
		expect(text).toContain('[log.txt](https://cdn.discordapp.com/log.txt)');
		expect(text).toContain('-# <t:1744338726:R>');
	});

	test('leaves out the avatar, gallery and file list when there are none', () => {
		const bare = renderStarPost(
			{ ...MESSAGE, author: { name: 'Sky.Bit' }, media: [], files: [], content: '' },
			3,
		);
		const [only] = bare.body.components;

		expect(only.components.map((component) => component.type)).toEqual([
			ComponentType.TextDisplay,
			ComponentType.TextDisplay,
		]);
		expect(JSON.stringify(only)).toContain('"**Sky.Bit** · <:mb_star_3:');
	});
});
