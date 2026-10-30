import { describe, expect, test } from 'bun:test';

import { androidColor, hexColor } from './android-colors';

describe('Android colors', () => {
	test('turns hex colors into opaque signed ARGB ints', () => {
		expect(androidColor('#ff0080')).toBe(0xffff0080 | 0);
		expect(androidColor('#000000')).toBe(0xff000000 | 0);
	});

	test('reads ARGB ints back as lowercase hex, without alpha', () => {
		expect(hexColor(0xff5865f2 | 0)).toBe('#5865f2');
		expect(hexColor(0x80000a0b)).toBe('#000a0b');
	});

	test('round-trips every color', () => {
		for (const hex of ['#123456', '#abcdef', '#ffffff'])
			expect(hexColor(androidColor(hex))).toBe(hex);
	});
});
