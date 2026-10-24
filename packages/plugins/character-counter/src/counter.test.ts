import { describe, expect, test } from 'bun:test';

import { characterLimit, counterTone } from './counter';

describe('characterLimit', () => {
	test('uses Discord message limits for standard and Nitro accounts', () => {
		expect(characterLimit(0)).toBe(2000);
		expect(characterLimit(undefined)).toBe(2000);
		expect(characterLimit(2)).toBe(4000);
	});
});

describe('counterTone', () => {
	test('moves through warning colors as the limit approaches', () => {
		expect(counterTone(999, 2000, true)).toBe('muted');
		expect(counterTone(1000, 2000, true)).toBe('yellow');
		expect(counterTone(1500, 2000, true)).toBe('orange');
		expect(counterTone(1800, 2000, true)).toBe('red');
	});

	test('stays on the primary color when warnings are off', () => {
		expect(counterTone(1950, 2000, false)).toBe('primary');
	});
});
