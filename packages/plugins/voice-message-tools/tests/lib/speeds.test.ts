import { describe, expect, test } from 'bun:test';

import { nextSpeed, speedLabel } from '~/lib/speeds';

describe('speed row', () => {
	test('steps through the speeds and wraps around', () => {
		expect(nextSpeed('1')).toBe('1.5');
		expect(nextSpeed('2')).toBe('0.75');
		expect(nextSpeed('0.75')).toBe('1');
		expect(nextSpeed('3')).toBe('1');
	});

	test('labels a speed', () => {
		expect(speedLabel(1.5)).toBe('1.5×');
		expect(speedLabel(1)).toBe('1×');
	});
});
