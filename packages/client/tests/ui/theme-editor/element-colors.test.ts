import { describe, expect, test } from 'bun:test';

import { sampleColors } from '~/ui/theme-editor/element-colors';

describe('sampleColors', () => {
	test('reads text, tint and border from the element, merging nested styles last-wins', () => {
		const samples = sampleColors([
			{
				style: [
					{ color: '#111111', borderTopColor: '#222222' },
					null,
					[{ color: '#333333', tintColor: '#444444' }],
				],
			},
			{ style: { backgroundColor: '#555555' } },
		]);

		expect(samples).toEqual([
			{ role: 'text', color: '#333333ff' },
			{ role: 'icon', color: '#444444ff' },
			{ role: 'border', color: '#222222ff' },
			{ role: 'background', color: '#555555ff' },
		]);
	});

	test('takes the nearest opaque background, skipping transparent ones', () => {
		const samples = sampleColors([
			{ style: { backgroundColor: 'transparent' } },
			{ style: { backgroundColor: '#00000000' } },
			{ style: { backgroundColor: '#123456' } },
			{ style: { backgroundColor: '#654321' } },
		]);

		expect(samples).toEqual([{ role: 'background', color: '#123456ff' }]);
	});

	test('reads a tint or fill passed as a prop', () => {
		expect(sampleColors([{ fill: { type: 0, payload: 0xff00ff00 } }])).toEqual([
			{ role: 'icon', color: '#00ff00ff' },
		]);
	});

	test('finds nothing without an element', () => {
		expect(sampleColors([])).toEqual([]);
	});
});
