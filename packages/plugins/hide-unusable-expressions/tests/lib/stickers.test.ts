import { describe, expect, test } from 'bun:test';

import { usableStickerCategories } from '~/lib/stickers';

const sendable = (sticker: { id?: string }) => sticker.id !== 'locked';

describe('usable sticker categories', () => {
	test('drops unsendable stickers and server sections left empty', () => {
		const categories = [
			{ type: 'FAVORITE', stickers: [{ id: '1' }, { id: 'locked' }] },
			{ type: 'GUILD', stickers: [{ id: 'locked' }] },
			{ type: 'GUILD', stickers: [{ id: '2' }] },
		];

		expect(usableStickerCategories(categories, sendable)).toEqual([
			{ type: 'FAVORITE', stickers: [{ id: '1' }] },
			{ type: 'GUILD', stickers: [{ id: '2' }] },
		]);
	});

	test('returns the same array when everything is sendable', () => {
		const categories = [{ type: 'GUILD', stickers: [{ id: '1' }] }];

		expect(usableStickerCategories(categories, sendable)).toBe(categories);
	});
});
