import { describe, expect, test } from 'bun:test';

import { singleSize, stackTiles } from '~/lib/stack';

describe('stackTiles', () => {
	test('sizes a wide image to the full width', () => {
		expect(singleSize(2, 600, 900)).toEqual({ width: 600, height: 300 });
	});

	test('narrows a tall image to the height limit', () => {
		expect(singleSize(0.5, 600, 900)).toEqual({ width: 450, height: 900 });
	});

	test('treats an unknown aspect as square', () => {
		expect(singleSize(0, 600, 900)).toEqual({ width: 600, height: 600 });
		expect(singleSize(Number.NaN, 600, 900)).toEqual({ width: 600, height: 600 });
	});

	test('stacks tiles with the spacing between rows', () => {
		expect(stackTiles([2, 0.5, 1], 600, 900, 8)).toEqual([
			{ top: 0, width: 600, height: 300 },
			{ top: 308, width: 450, height: 900 },
			{ top: 1216, width: 600, height: 600 },
		]);
	});
});
