import { describe, expect, test } from 'bun:test';

import { daltonize, daltonizeArgb, daltonizeHex } from '~/lib/daltonize';

describe('daltonize', () => {
	test('leaves greys alone', () => {
		expect(daltonize([128, 128, 128], 'deuteranopia')).toEqual([128, 128, 128]);
	});

	test('moves red and green apart for deuteranopia', () => {
		const red = daltonize([220, 40, 40], 'deuteranopia');
		const green = daltonize([40, 180, 40], 'deuteranopia');

		expect(red[2] - green[2]).toBeGreaterThan(40 - 40);
		expect(red).not.toEqual([220, 40, 40]);
	});

	test('changes nothing at zero strength', () => {
		expect(daltonize([220, 40, 40], 'protanopia', 0)).toEqual([220, 40, 40]);
	});
});

describe('daltonizeArgb', () => {
	test('keeps alpha and returns a signed integer', () => {
		const argb = daltonizeArgb(0xffdc2828 | 0, 'protanopia');

		expect(argb >>> 24).toBe(0xff);
		expect(argb).toBeLessThan(0);
	});
});

describe('daltonizeHex', () => {
	test('round-trips a grey and rejects anything else', () => {
		expect(daltonizeHex('#808080', 'tritanopia')).toBe('#808080');
		expect(daltonizeHex('red', 'tritanopia')).toBeUndefined();
	});
});
