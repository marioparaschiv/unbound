import { describe, expect, test } from 'bun:test';

import { readRect } from './rect';

describe('readRect', () => {
	test('reads a CGRect boxed in an NSValue', () => {
		expect(
			readRect({ value: { origin: { x: 4, y: 40 }, size: { width: 200, height: 217.5 } } }),
		).toEqual({
			x: 4,
			y: 40,
			width: 200,
			height: 217.5,
		});
	});

	test('reads a flat CGSize', () => {
		expect(readRect({ width: 120, height: 30 })).toEqual({
			x: 0,
			y: 0,
			width: 120,
			height: 30,
		});
	});

	test('reads a missing value as an empty rect', () => {
		expect(readRect(null)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
	});
});
