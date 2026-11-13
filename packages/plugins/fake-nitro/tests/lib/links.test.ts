import { describe, expect, test } from 'bun:test';

import { emojiLink, replaceEmojis, stickerLink } from '~/lib/links';

const odin = { id: '123', name: 'Odin', animated: false };
const dance = { id: '456', name: 'Dance', animated: true };

describe('fake emojis and stickers', () => {
	test('links an emoji with its size and name', () => {
		expect(emojiLink(dance, 48, false)).toBe(
			'https://cdn.discordapp.com/emojis/456.webp?size=48&animated=true&name=Dance&lossless=true',
		);
		expect(emojiLink(odin, 48, true)).toBe(
			'[Odin](https://cdn.discordapp.com/emojis/123.webp?size=48&name=Odin&lossless=true)',
		);
	});

	test('links only the emojis the sender cannot use', () => {
		const text = replaceEmojis(
			'hi <:Odin:123> and <a:Dance:456>',
			[odin, dance],
			(emoji) => !emoji.animated,
			(emoji) => `LINK(${emoji.name})`,
		);

		expect(text).toBe('hi <:Odin:123> and LINK(Dance)');
	});

	test('links image stickers and skips Lottie ones', () => {
		expect(stickerLink({ id: '9', name: 'Hi', format_type: 4 }, 160, false)).toBe(
			'https://media.discordapp.net/stickers/9.gif?size=160',
		);
		expect(stickerLink({ id: '9', name: 'Hi', format_type: 3 }, 160, false)).toBeUndefined();
	});
});
