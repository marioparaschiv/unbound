import { describe, expect, test } from 'bun:test';

import { profileEffects } from '~/lib/effects';

describe('profile effects', () => {
	test('keeps each profile effect once, sorted by title', () => {
		const products = [
			{ items: [{ type: 1, skuId: '2', title: 'Zap', thumbnailPreviewSrc: 'z' }] },
			{ items: [{ type: 0, skuId: '3', title: 'Decoration' }] },
			{
				items: [
					{ type: 1, skuId: '1', title: 'Aura' },
					{ type: 1, skuId: '2', title: 'Zap' },
				],
			},
			{},
		];

		expect(profileEffects(products)).toEqual([
			{ skuId: '1', title: 'Aura', thumbnailPreviewSrc: undefined },
			{ skuId: '2', title: 'Zap', thumbnailPreviewSrc: 'z' },
		]);
	});
});
