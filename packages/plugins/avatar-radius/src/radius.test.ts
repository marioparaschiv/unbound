import { describe, expect, test } from 'bun:test';

import { cornerRadius, storedRadius } from './radius';

describe('avatar radius', () => {
	test('reads the stored radius, clamped and rounded', () => {
		expect(storedRadius(12)).toBe(12);
		expect(storedRadius('6.4')).toBe(6);
		expect(storedRadius(-3)).toBe(0);
		expect(storedRadius(500)).toBe(64);
	});

	test('falls back to the default for missing or unusable values', () => {
		expect(storedRadius(undefined)).toBe(8);
		expect(storedRadius(null)).toBe(8);
		expect(storedRadius('')).toBe(8);
		expect(storedRadius('round')).toBe(8);
	});

	test('never rounds an avatar past a circle', () => {
		expect(cornerRadius(8, 40)).toBe(8);
		expect(cornerRadius(30, 40)).toBe(20);
		expect(cornerRadius(8, 0)).toBe(8);
	});
});
