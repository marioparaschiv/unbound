import { describe, expect, test } from 'bun:test';

import { filletData, pathData } from '~/native/android/path-data';

describe('android path data', () => {
	test('writes lines and curves offset into the row and scaled to pixels', () => {
		const steps = [
			[0, 0],
			[10, 0],
			[10, 5, 10, 10, 5, 10],
		];

		expect(pathData(steps, { x: 1, y: 2 }, 2)).toBe('M2 4 L22 4 C22 14 22 24 12 24 Z');
	});

	test('rounds coordinates to two decimals', () => {
		expect(pathData([[1 / 3, 2 / 3]], { x: 0, y: 0 }, 1)).toBe('M0.33 0.67 Z');
	});

	test('writes nothing for an empty outline', () => {
		expect(pathData([], { x: 0, y: 0 }, 1)).toBe('');
	});

	test('writes no fillets when the bubble has none', () => {
		expect(filletData({ x: 0, y: 0, width: 10, height: 10 }, { top: 0, bottom: 0 }, 1)).toBe(
			'',
		);
	});

	test('writes a closed curve right of the bubble for each fillet', () => {
		const frame = { x: 0, y: 0, width: 10, height: 20 };
		const data = filletData(frame, { top: 4, bottom: 4 }, 1);
		const shapes = data.split(' Z').filter(Boolean);

		expect(shapes).toHaveLength(2);
		expect(shapes[0]).toStartWith('M10 0 L14 0 C');
		expect(shapes[1]!.trim()).toStartWith('M10 20 L10 16 C');
	});
});
