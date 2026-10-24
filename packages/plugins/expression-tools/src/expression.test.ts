import { describe, expect, test } from 'bun:test';

import {
	getAssetUrl,
	getEmojiMarkup,
	getExpressionLink,
	getSheetKind,
	parseEmoji,
	parseSticker,
	type Sticker,
} from './expression';

function sticker(formatType: number): Sticker {
	return {
		kind: 'sticker',
		id: '9',
		name: 'wave',
		description: '',
		formatType,
		tags: 'wave',
	};
}

describe('getSheetKind', () => {
	test('reads the kind from the sheet key, ignoring case', () => {
		expect(getSheetKind('EmojiDetailActionSheet')).toBe('emoji');
		expect(getSheetKind('StickerDetailActionSheet')).toBe('sticker');
		expect(getSheetKind('MessageLongPressActionSheet')).toBe(null);
	});
});

describe('parseEmoji', () => {
	test('reads a custom emoji from its props', () => {
		expect(parseEmoji({ emoji: { id: '1', name: 'blob', animated: true } })).toEqual({
			kind: 'emoji',
			id: '1',
			name: 'blob',
			animated: true,
		});
	});

	test('falls back to the image URL and alt text', () => {
		const emojiNode = {
			src: 'https://cdn.discordapp.com/emojis/42.gif?size=48',
			alt: ':party:',
		};

		expect(parseEmoji({ emojiNode })).toEqual({
			kind: 'emoji',
			id: '42',
			name: 'party',
			animated: true,
		});
	});

	test('rejects a unicode emoji', () => {
		expect(parseEmoji({ emoji: { id: null, name: '😀' } })).toBe(null);
		expect(parseEmoji(undefined)).toBe(null);
	});
});

describe('parseSticker', () => {
	test('finds a sticker nested in props and fills defaults', () => {
		const props = { data: [{ other: true }, { sticker: { id: '9', format_type: 1 } }] };

		expect(parseSticker(props)).toEqual({
			kind: 'sticker',
			id: '9',
			name: 'sticker',
			description: '',
			formatType: 1,
			tags: 'sticker',
		});
	});

	test('uses the name as tags when the sticker has none', () => {
		expect(parseSticker({ id: '9', format_type: 4, name: 'wave', description: null })).toEqual({
			kind: 'sticker',
			id: '9',
			name: 'wave',
			description: '',
			formatType: 4,
			tags: 'wave',
		});
	});

	test('returns null when no sticker is present', () => {
		expect(parseSticker({ id: '9' })).toBe(null);
	});
});

describe('links', () => {
	test('builds emoji image URLs and markup', () => {
		const emoji = { kind: 'emoji', id: '1', name: 'blob', animated: false } as const;

		expect(getExpressionLink(emoji)).toBe(
			'https://cdn.discordapp.com/emojis/1.png?size=160&quality=lossless',
		);
		expect(getEmojiMarkup(emoji)).toBe('<:blob:1>');
		expect(getEmojiMarkup({ ...emoji, animated: true })).toBe('<a:blob:1>');
	});

	test('picks the sticker file by format', () => {
		expect(getAssetUrl(sticker(1))).toBe(
			'https://media.discordapp.net/stickers/9.png?size=160&quality=lossless',
		);
		expect(getAssetUrl(sticker(3))).toContain('/stickers/9.json');
		expect(getAssetUrl(sticker(4))).toContain('/stickers/9.gif');
		expect(getExpressionLink(sticker(1))).toBe('https://discord.com/stickers/9');
	});
});
