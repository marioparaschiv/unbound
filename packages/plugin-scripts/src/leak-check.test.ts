import { expect, test } from 'bun:test';

import { growthPerCycle, leakNote } from './leak-check';

test('works out live heap growth per cycle', () => {
	expect(growthPerCycle(80 * 1_048_576, 83 * 1_048_576, 5)).toBe(0.6);
	expect(growthPerCycle(-1, 10, 5)).toBeUndefined();
	expect(growthPerCycle(10, 20, 0)).toBeUndefined();
});

test('fails only growth above the threshold', () => {
	expect(leakNote(0.6, 5)).toBe('the live JS heap grew 0.6 MB per cycle over 5 cycles');
	expect(leakNote(0.5, 5)).toBeUndefined();
	expect(leakNote(-0.2, 5)).toBeUndefined();
	expect(leakNote(undefined, 5)).toBeUndefined();
});
