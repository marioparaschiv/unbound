import { describe, expect, test } from 'bun:test';

import { hasSlot } from '~/lib/slot';

describe('hasSlot', () => {
	test('finds room below the limit', () => {
		expect(hasSlot(4, 5)).toBe(true);
		expect(hasSlot(5, 5)).toBe(false);
		expect(hasSlot(6, 5)).toBe(false);
	});

	test('always finds room without a limit', () => {
		expect(hasSlot(99, 0)).toBe(true);
	});
});
