import { describe, expect, test } from 'bun:test';

import { bubbleFrame, isLaidOut, rowInsets, sharedContentStart, union } from './geometry';

const padding = { horizontal: 8, vertical: 4 };

describe('bubble geometry', () => {
	test('hugs the content and adds the padding around it', () => {
		expect(bubbleFrame({ x: 68, y: 38, width: 291, height: 50 }, 120, padding)).toEqual({
			x: 60,
			y: 34,
			width: 136,
			height: 58,
		});
	});

	test('keeps the full body width when the content is unknown or wider', () => {
		expect(bubbleFrame({ x: 0, y: 0, width: 100, height: 20 }, 0, padding).width).toBe(116);
		expect(bubbleFrame({ x: 0, y: 0, width: 100, height: 20 }, 400, padding).width).toBe(116);
	});

	test('stops at the header above the body instead of covering it', () => {
		expect(bubbleFrame({ x: 68, y: 38, width: 291, height: 50 }, 120, padding, 36)).toEqual({
			x: 60,
			y: 36,
			width: 136,
			height: 56,
		});
		expect(bubbleFrame({ x: 68, y: 38, width: 291, height: 50 }, 120, padding, 30).y).toBe(34);
		expect(bubbleFrame({ x: 68, y: 38, width: 291, height: 50 }, 120, padding, 50).y).toBe(38);
	});

	test('uses the padding it is given', () => {
		expect(
			bubbleFrame({ x: 100, y: 100, width: 50, height: 10 }, 0, {
				horizontal: 16,
				vertical: 8,
			}),
		).toEqual({
			x: 84,
			y: 92,
			width: 82,
			height: 26,
		});
	});

	test('unions child bounds', () => {
		expect(
			union([
				{ left: 10, top: 5, right: 50, bottom: 20 },
				{ left: 8, top: 20, right: 40, bottom: 60 },
			]),
		).toEqual({ left: 8, top: 5, right: 50, bottom: 60 });
		expect(union([])).toBeUndefined();
	});

	test('places a bubble inside a row with non-negative insets', () => {
		expect(rowInsets({ x: 150, y: 10, width: 300, height: 80 }, 1080, 120)).toEqual({
			left: 150,
			top: 10,
			right: 630,
			bottom: 30,
		});
		expect(rowInsets({ x: -4, y: -2, width: 2000, height: 200 }, 1080, 120)).toEqual({
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		});
	});
});

describe('shared content start', () => {
	test('ignores rows that have not been laid out', () => {
		expect(isLaidOut(undefined)).toBe(false);
		expect(isLaidOut(0)).toBe(false);
		expect(isLaidOut(148)).toBe(true);
	});

	test('aligns to the smallest laid-out left among recent rows', () => {
		expect(sharedContentStart([168, 148, 0, 168])).toBe(148);
		expect(sharedContentStart([])).toBe(Number.POSITIVE_INFINITY);
	});
});
