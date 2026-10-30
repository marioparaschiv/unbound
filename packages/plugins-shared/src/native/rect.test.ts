import { describe, expect, test } from 'bun:test';

import { parseRect, parseSize, readRect } from './rect';

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

describe('parseRect', () => {
	test('reads a CGRect boxed in an NSValue, or with a boxed origin and size', () => {
		const rect = { x: 4, y: 40, width: 200, height: 217.5 };

		expect(
			parseRect({ value: { origin: { x: 4, y: 40 }, size: { width: 200, height: 217.5 } } }),
		).toEqual(rect);
		expect(
			parseRect({
				origin: { value: { x: 4, y: 40 } },
				size: { value: { width: 200, height: 217.5 } },
			}),
		).toEqual(rect);
		expect(parseRect(rect)).toEqual(rect);
	});

	test('reads a rect with a missing or non-finite field as missing', () => {
		expect(parseRect(null)).toBeUndefined();
		expect(parseRect({ value: { size: { width: 1, height: 2 } } })).toBeUndefined();
		expect(
			parseRect({ origin: { x: 0, y: null }, size: { width: 1, height: 2 } }),
		).toBeUndefined();
		expect(
			parseRect({ origin: { x: 0, y: 0 }, size: { width: Infinity, height: 2 } }),
		).toBeUndefined();
	});
});

describe('parseSize', () => {
	test('reads a CGSize boxed or not', () => {
		expect(parseSize({ value: { width: 120, height: 30 } })).toEqual({
			width: 120,
			height: 30,
		});
		expect(parseSize({ width: 120, height: 30 })).toEqual({ width: 120, height: 30 });
	});

	test('reads a size with a missing field as missing', () => {
		expect(parseSize({ value: { width: 120 } })).toBeUndefined();
		expect(parseSize(undefined)).toBeUndefined();
	});
});
