import { describe, expect, test } from 'bun:test';

import {
	bubbleFrame,
	isLaidOut,
	rowInsets,
	rowContentStart,
	cardFrame,
	columnEndFrom,
	union,
	bubbleProblem,
	frameDrift,
} from '~/lib/geometry';

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

describe('row content start', () => {
	test('ignores rows that have not been laid out', () => {
		expect(isLaidOut(undefined)).toBe(false);
		expect(isLaidOut(0)).toBe(false);
		expect(isLaidOut(148)).toBe(true);
	});

	test("starts at the row's own content column, reaching back for an indented body", () => {
		expect(rowContentStart(168, 168)).toBe(168);
		expect(rowContentStart(200, 168)).toBe(168);
		expect(rowContentStart(168, 0)).toBe(168);
		expect(rowContentStart(168, undefined)).toBe(168);
	});

	test("never follows another row's narrower column under the avatar", () => {
		const rows = [
			rowContentStart(168, 168),
			rowContentStart(53, 53),
			rowContentStart(168, 168),
		];

		expect(rows).toEqual([168, 53, 168]);
	});
});

describe('bubble problems', () => {
	test('accepts a bubble beside the avatar column that fits its row', () => {
		expect(bubbleProblem({ x: 60, y: 0, width: 120, height: 30 }, 375, 104)).toBeUndefined();
	});

	test('flags bubbles that wrap nothing, reach the left edge or run past their row', () => {
		expect(bubbleProblem({ x: 60, y: 0, width: 120, height: 30 }, 375, 0)).toBe(
			'wraps no content',
		);
		expect(bubbleProblem({ x: 0, y: 0, width: 120, height: 30 }, 375, 104)).toBe(
			'reaches the left edge of the screen',
		);
		expect(bubbleProblem({ x: 60, y: 0, width: 330, height: 30 }, 375, 314)).toBe(
			'runs past its row',
		);
	});

	test('flags a bubble that starts left of its content column', () => {
		expect(bubbleProblem({ x: 32, y: 0, width: 300, height: 30 }, 1080, 280, 147)).toBe(
			'reaches over the avatar column',
		);
		expect(
			bubbleProblem({ x: 147, y: 0, width: 300, height: 30 }, 1080, 280, 147),
		).toBeUndefined();
	});
});

describe('card frame', () => {
	test('covers the whole content column and reaches past both sides', () => {
		expect(cardFrame({ x: 68, y: 16, width: 291, height: 72 }, 5)).toEqual({
			x: 63,
			y: 16,
			width: 301,
			height: 72,
		});
	});
});

describe('column end', () => {
	test('ends a filling row at its widest filling child and learns the gutter', () => {
		expect(columnEndFrom([700, 720], 760, undefined)).toEqual({ end: 720, gutter: 40 });
	});

	test('relearns the gutter from a filling row when one is already known', () => {
		expect(columnEndFrom([730], 760, 40)).toEqual({ end: 730, gutter: 30 });
	});

	test('ends a media-only row at the known gutter', () => {
		expect(columnEndFrom([], 760, 40)).toEqual({ end: 720, gutter: 40 });
	});

	test('leaves the end unknown until a gutter is learned', () => {
		expect(columnEndFrom([], 760, undefined)).toEqual({ end: undefined, gutter: undefined });
	});
});

describe('frame drift', () => {
	test('measures the furthest edge a drawn bubble is off by', () => {
		const expected = { x: 60, y: 0, width: 120, height: 30 };

		expect(frameDrift(expected, expected)).toBe(0);
		expect(frameDrift({ ...expected, height: 90 }, expected)).toBe(60);
		expect(frameDrift({ ...expected, x: 58, width: 124 }, expected)).toBe(2);
	});
});
