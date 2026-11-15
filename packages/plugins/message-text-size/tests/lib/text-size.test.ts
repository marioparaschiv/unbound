import { describe, expect, test } from 'bun:test';

import { baseSize, scaleOf } from '~/lib/text-size';

describe('scaleOf', () => {
	test('turns percent into a factor within the slider range', () => {
		expect(scaleOf(115)).toBe(1.15);
		expect(scaleOf(10)).toBe(0.5);
		expect(scaleOf(500)).toBe(2);
		expect(scaleOf(0)).toBe(1);
	});
});

describe('baseSize', () => {
	test('keeps Discord size while the text still has the plugin size, so binds never compound', () => {
		expect(baseSize(46, { base: 40, applied: 46 })).toBe(40);
	});

	test('takes the new size once Discord sets its own', () => {
		expect(baseSize(42, { base: 40, applied: 46 })).toBe(42);
		expect(baseSize(40, undefined)).toBe(40);
	});
});
