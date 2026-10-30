import { describe, expect, test } from 'bun:test';

import { describeScreenChange, differenceRatio } from './screen-diff';

describe('screen changes', () => {
	test('reads the share ImageMagick prints', () => {
		expect(differenceRatio('441 (0.049)')).toBe(0.049);
		expect(differenceRatio('0 (0)')).toBe(0);
		expect(differenceRatio('compare: images differ in size')).toBeUndefined();
	});

	test('reports only changes large enough to look at', () => {
		expect(describeScreenChange('unbound.demo settings', 0.001)).toBeUndefined();
		expect(describeScreenChange('unbound.demo settings', undefined)).toBeUndefined();
		expect(describeScreenChange('unbound.demo settings', 0.12)).toBe(
			'unbound.demo settings screen looks different from the last run (12.0% of pixels)',
		);
	});
});
