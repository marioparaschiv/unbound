import { describe, expect, test } from 'bun:test';

import { realExpressions } from '~/lib/receive';

const emojiUrl =
	'https://cdn.discordapp.com/emojis/1373930998265286727.webp?size=48&name=socute&lossless=true';
const animatedUrl =
	'https://cdn.discordapp.com/emojis/669518972407775265.webp?size=48&animated=true&name=siren~1&lossless=true';
const stickerUrl = 'https://media.discordapp.net/stickers/749054660769218631.png?size=160';

describe('received fake emojis and stickers', () => {
	test('turns emoji links, bare or masked, back into emojis and drops their embeds', () => {
		const message = {
			content: `so ${emojiUrl} and [siren~1](${animatedUrl})`,
			embeds: [
				{ url: emojiUrl },
				{ url: 'https://example.com' },
				{ thumbnail: { url: animatedUrl } },
			],
		};

		expect(realExpressions(message)).toEqual({
			content: 'so <:socute:1373930998265286727> and <a:siren:669518972407775265>',
			embeds: [{ url: 'https://example.com' }],
			sticker_items: [],
		});
	});

	test('names an emoji from its masked text when the link has no name', () => {
		const message = {
			content: '[Odin](https://cdn.discordapp.com/emojis/123456789012345678.png)',
		};

		expect(realExpressions(message)?.content).toBe('<:Odin:123456789012345678>');
	});

	test('turns a message of only sticker links into stickers', () => {
		const message = { content: `[Wave](${stickerUrl})`, embeds: [{ url: stickerUrl }] };

		expect(realExpressions(message)).toEqual({
			content: '',
			embeds: [],
			sticker_items: [{ id: '749054660769218631', name: 'Wave', format_type: 1 }],
		});
	});

	test('leaves a sticker link inside other text, and messages without links', () => {
		expect(realExpressions({ content: `look ${stickerUrl}` })).toBeUndefined();
		expect(realExpressions({ content: 'hello' })).toBeUndefined();
		expect(
			realExpressions({ content: 'https://cdn.discordapp.com/attachments/1/2/cat.png' }),
		).toBeUndefined();
	});

	test('respects which kinds to turn back', () => {
		expect(realExpressions({ content: emojiUrl }, { emojis: false })).toBeUndefined();
		expect(realExpressions({ content: stickerUrl }, { stickers: false })).toBeUndefined();
	});
});
