import { describe, expect, test } from 'bun:test';

import { usableCategories } from '~/lib/categories';

describe('usable emoji categories', () => {
	test('drops locked servers, disabled emojis and servers left empty', () => {
		const categories = [
			{
				type: 'FAVORITES',
				emojis: [{ id: '1' }, { name: '😀' }],
				emojisDisabled: new Set(['1']),
			},
			{ type: 'GUILD', isNitroLocked: true, emojis: [{ id: '2' }] },
			{ type: 'GUILD', emojis: [{ id: '3' }], emojisDisabled: new Set(['3']) },
			{ type: 'GUILD', emojis: [{ id: '4' }, { id: '5' }], emojisDisabled: new Set(['5']) },
		];

		expect(usableCategories(categories)).toEqual([
			{ type: 'FAVORITES', emojis: [{ name: '😀' }], emojisDisabled: new Set(['1']) },
			{ type: 'GUILD', emojis: [{ id: '4' }], emojisDisabled: new Set(['5']) },
		]);
	});

	test('keeps the same sections when everything is usable', () => {
		const categories = [
			{ type: 'RECENT', emojis: [{ id: '1' }], emojisDisabled: new Set<string>() },
		];

		expect(usableCategories(categories)).toBe(categories);
	});
});
