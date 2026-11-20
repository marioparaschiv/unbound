import { describe, expect, test } from 'bun:test';

import { isNightHour } from '~/lib/schedule';

describe('isNightHour', () => {
	test('wraps past midnight', () => {
		expect(isNightHour(23, 21, 7)).toBe(true);
		expect(isNightHour(3, 21, 7)).toBe(true);
		expect(isNightHour(7, 21, 7)).toBe(false);
		expect(isNightHour(12, 21, 7)).toBe(false);
	});

	test('handles a night within one day and an empty one', () => {
		expect(isNightHour(2, 1, 5)).toBe(true);
		expect(isNightHour(5, 1, 5)).toBe(false);
		expect(isNightHour(4, 4, 4)).toBe(false);
	});
});
