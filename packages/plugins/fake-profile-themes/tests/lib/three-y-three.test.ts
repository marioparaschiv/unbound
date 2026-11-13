import { describe, expect, test } from 'bun:test';

import {
	decodeThemeColors,
	encodeThemeColors,
	parseHex,
	stripThemeColors,
} from '~/lib/three-y-three';

describe('3y3 theme colors', () => {
	test('round-trips two colors through invisible characters', () => {
		const code = encodeThemeColors(0x5865f2, 0xeb459e);

		expect(
			code
				.trim()
				.split('')
				.every((character) => character.codePointAt(0)! >= 0xe0000),
		).toBe(true);
		expect(decodeThemeColors(`Hello there${code}`)).toEqual([0x5865f2, 0xeb459e]);
	});

	test('reads the code Vencord writes, short colors included', () => {
		const vencord = Array.from('[#ff0000,#abc]')
			.map((character) => String.fromCodePoint(character.codePointAt(0)! + 0xe0000))
			.join('');

		expect(decodeThemeColors(`bio ${vencord}`)).toEqual([0xff0000, 0xabc]);
	});

	test('finds nothing in a plain bio', () => {
		expect(decodeThemeColors('just a bio')).toBeUndefined();
		expect(decodeThemeColors(null)).toBeUndefined();
	});

	test('strips the code and its space from a bio', () => {
		expect(stripThemeColors(`Hello there${encodeThemeColors(1, 2)}`)).toBe('Hello there');
	});

	test('reads only full hex colors', () => {
		expect(parseHex('#5865F2')).toBe(0x5865f2);
		expect(parseHex('blue')).toBeUndefined();
	});
});
