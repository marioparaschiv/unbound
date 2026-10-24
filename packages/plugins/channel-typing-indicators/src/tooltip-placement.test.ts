import { describe, expect, test } from 'bun:test';

import { tooltipPlacement } from './tooltip-placement';

describe('tooltipPlacement', () => {
	test('sits above the indicator inside the window, pointing at its center', () => {
		const placement = tooltipPlacement({ x: 270, y: 500, width: 40, height: 16 }, 28, 375);

		expect(placement.arrowDirection).toBe('DOWN');
		expect(placement.left).toBeGreaterThanOrEqual(8);
		expect(placement.left + placement.width).toBeLessThanOrEqual(367);
		expect(placement.left + placement.arrowOffset + 8).toBe(290);
	});

	test('drops below the indicator near the top of the window', () => {
		const placement = tooltipPlacement({ x: 16, y: 30, width: 40, height: 16 }, 28, 375);

		expect(placement.arrowDirection).toBe('UP');
		expect(placement.top).toBeGreaterThan(46);
	});
});
