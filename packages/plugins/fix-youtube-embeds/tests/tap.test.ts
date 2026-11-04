import { describe, expect, test } from 'bun:test';

import { isTap } from '~/youtube-embeds/tap';

const START = { x: 100, y: 200, time: 1000 };

describe('isTap', () => {
	test('accepts a short touch that barely moved', () => {
		expect(isTap(START, { x: 104, y: 203, time: 1120 })).toBe(true);
		expect(isTap(START, START)).toBe(true);
	});

	test('rejects drags and swipes', () => {
		expect(isTap(START, { x: 160, y: 200, time: 1100 })).toBe(false);
		expect(isTap(START, { x: 100, y: 240, time: 1100 })).toBe(false);
	});

	test('rejects long presses', () => {
		expect(isTap(START, { x: 100, y: 200, time: 1600 })).toBe(false);
	});

	test('rejects touches without a single-finger start', () => {
		expect(isTap(undefined, START)).toBe(false);
		expect(isTap(START, { x: 100, y: 200, time: 900 })).toBe(false);
	});
});
