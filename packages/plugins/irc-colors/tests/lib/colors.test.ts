import { describe, expect, test } from 'bun:test';

import { userArgb, userHue } from '~/lib/colors';

describe('colors', () => {
	test('hashes the id and seed into a hue', () => {
		expect(userHue('224617799434108928', '')).toBe(109);
	});

	test('changes the hue with the seed', () => {
		expect(userHue('224617799434108928', 'shuffle')).not.toBe(109);
	});

	test('builds a signed opaque ARGB color from the hue', () => {
		expect(userArgb('1', { lightness: 50, saturation: 100, seed: '' }) >>> 24).toBe(0xff);
		expect(userArgb('1', { lightness: 100, saturation: 100, seed: '' })).toBe(-1);
		expect(userArgb('1', { lightness: 0, saturation: 100, seed: '' })).toBe(0xff000000 | 0);
	});
});
