import { describe, expect, test } from 'bun:test';

import { packId, readPack, stickerUrl } from '~/lib/line';

describe('LINE packs', () => {
	test('read the pack number from links and bare numbers', () => {
		expect(packId('https://store.line.me/stickershop/product/1070/en')).toBe('1070');
		expect(packId(' 25358 ')).toBe('25358');
		expect(packId('https://example.com')).toBeUndefined();
	});

	test('read metadata into a pack in the user language', () => {
		const meta = {
			packageId: 1070,
			title: { en: 'Moon', ja: 'ムーン' },
			stickers: [{ id: 17839, width: 248, height: 224 }, { id: 'bad' }],
		};

		expect(readPack(meta, 'ja')).toEqual({
			id: '1070',
			title: 'ムーン',
			stickers: [{ id: '17839', width: 248, height: 224 }],
		});
		expect(readPack({ packageId: 1 }, 'en')).toBeUndefined();
		expect(stickerUrl('17839')).toBe(
			'https://stickershop.line-scdn.net/stickershop/v1/sticker/17839/android/sticker.png',
		);
	});
});
