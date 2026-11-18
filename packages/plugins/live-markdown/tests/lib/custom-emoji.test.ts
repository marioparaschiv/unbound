import { describe, expect, test } from 'bun:test';

import { emojiTokens, emojiUrl } from '~/lib/custom-emoji';

const known = { Minecraft: { id: '1052541511037898852', animated: true } };

describe('emojiTokens', () => {
	test('finds picked emoji by name and raw markdown by id', () => {
		expect(emojiTokens('hi :Minecraft: and <:blob:123456789012345678>', known)).toEqual([
			{ start: 3, length: 11, id: '1052541511037898852', animated: true },
			{ start: 19, length: 26, id: '123456789012345678', animated: false },
		]);
	});

	test('leaves unknown names and times alone', () => {
		expect(emojiTokens(':nope: at 12:30:45', known)).toEqual([]);
	});
});

describe('emojiUrl', () => {
	test('asks for a GIF only for animated emoji', () => {
		expect(emojiUrl({ id: '1', animated: true })).toBe(
			'https://cdn.discordapp.com/emojis/1.gif?size=96',
		);
		expect(emojiUrl({ id: '2', animated: false }, 48)).toBe(
			'https://cdn.discordapp.com/emojis/2.png?size=48',
		);
	});
});
