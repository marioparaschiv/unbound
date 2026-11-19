import { describe, expect, test } from 'bun:test';

import { isMemoryPressure } from '~/plugins/trim-level';

describe('memory pressure', () => {
	test('counts running low and worse as pressure', () => {
		expect(isMemoryPressure({ type: 'int', value: 10 })).toBe(true);
		expect(isMemoryPressure({ type: 'int', value: 80 })).toBe(true);
	});

	test('ignores milder trims and odd values', () => {
		expect(isMemoryPressure({ type: 'int', value: 5 })).toBe(false);
		expect(isMemoryPressure(undefined)).toBe(false);
		expect(isMemoryPressure({ type: 'string', value: '80' })).toBe(false);
	});
});
