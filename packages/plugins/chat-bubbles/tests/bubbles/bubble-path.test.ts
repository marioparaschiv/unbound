import { describe, expect, test } from 'bun:test';

import { bubblePath, cornerRadii } from '~/bubbles/bubble-path';
import { Corner } from '~/bubbles/group';

const square = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

describe('cornerRadii', () => {
	test('softens the corners that do not round, and leaves the tail corner square', () => {
		expect(cornerRadii(Corner.topRight | Corner.bottomRight, 16, 3.2, 'bottom')).toEqual({
			topLeft: 3.2,
			topRight: 16,
			bottomRight: 16,
			bottomLeft: 0,
		});
	});
});

describe('bubblePath', () => {
	test('draws square corners as their points, clockwise from the top right', () => {
		expect(bubblePath(40, 20, square, true)).toEqual([
			[40, 0],
			[40, 20],
			[0, 20],
			[0, 0],
		]);
	});

	test('runs a bottom tail out of the square bottom left corner, left of the bubble', () => {
		expect(bubblePath(40, 20, square, true, { side: 'bottom', size: 6 })).toEqual([
			[40, 0],
			[40, 20],
			[-6, 20],
			[0, 14],
			[0, 0],
		]);
	});

	test('runs a top tail out of the square top left corner, left of the bubble', () => {
		expect(bubblePath(40, 20, square, true, { side: 'top', size: 6 })).toEqual([
			[40, 0],
			[40, 20],
			[0, 20],
			[0, 6],
			[-6, 0],
		]);
	});

	test('rounds each corner by its own radius', () => {
		const steps = bubblePath(40, 20, { ...square, topRight: 8, bottomLeft: 2 }, false);

		expect(steps[0]).toEqual([32, 0]);
		expect(steps[1]!.slice(-2)).toEqual([40, 8]);
		expect(steps[2]).toEqual([40, 20]);
		expect(steps[3]).toEqual([2, 20]);
		expect(steps[4]!.slice(-2)).toEqual([0, 18]);
		expect(steps[5]).toEqual([0, 0]);
	});

	test('bends a continuous corner over about one and a half radii of each side', () => {
		const steps = bubblePath(40, 40, { ...square, bottomRight: 10 }, true);

		expect(steps[1]).toEqual([40, 24.71]);
		expect(steps.at(-3)!.slice(-2)).toEqual([24.71, 40]);
	});
});
