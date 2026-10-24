import { describe, expect, test } from 'bun:test';

import { placeTooltip, tooltipTextWidth } from './tooltip-layout';

const bounds = { x: 0, y: 0, width: 320, height: 640 };
const text = { width: 120, height: 18 };

describe('tooltipTextWidth', () => {
	test('caps the bubble at 250 points and keeps 16 points of margin', () => {
		expect(tooltipTextWidth(1000)).toBe(230);
		expect(tooltipTextWidth(200)).toBe(148);
		expect(tooltipTextWidth(50)).toBe(100);
	});
});

describe('placeTooltip', () => {
	test('centers the bubble below the icon', () => {
		const placement = placeTooltip(text, { x: 100, y: 100, width: 12, height: 12 }, bounds);

		expect(placement).toEqual({
			frame: { x: 32, y: 115, width: 148, height: 46 },
			below: true,
			arrowOffset: 66,
		});
	});

	test('flips above the icon near the bottom and stays inside the window edge', () => {
		const placement = placeTooltip(text, { x: 310, y: 620, width: 12, height: 12 }, bounds);

		expect(placement?.below).toBe(false);
		expect(placement?.frame).toEqual({ x: 164, y: 571, width: 148, height: 46 });
	});

	test('rejects text without a size', () => {
		expect(placeTooltip({ width: 0, height: 18 }, bounds, bounds)).toBeNull();
		expect(placeTooltip({ width: 120, height: Number.NaN }, bounds, bounds)).toBeNull();
	});
});
