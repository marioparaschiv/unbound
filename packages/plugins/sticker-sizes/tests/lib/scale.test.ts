import { describe, expect, test } from 'bun:test';

import { parseScale, scaleMeasureSpec } from '~/lib/scale';

const EXACTLY = 0x40000000;
const AT_MOST = 0x80000000 | 0;

describe('sticker scale', () => {
	test('reads the setting', () => {
		expect(parseScale('75')).toBe(0.75);
		expect(parseScale('nope')).toBe(1);
	});

	test('scales a measure spec to an exact size', () => {
		expect(scaleMeasureSpec(EXACTLY | 420, 0.5)).toBe(EXACTLY | 210);
		expect(scaleMeasureSpec(AT_MOST | 420, 1.5)).toBe(EXACTLY | 630);
	});

	test('leaves unspecified and unscaled specs alone', () => {
		expect(scaleMeasureSpec(0, 0.5)).toBe(0);
		expect(scaleMeasureSpec(EXACTLY | 420, 1)).toBe(EXACTLY | 420);
	});
});
