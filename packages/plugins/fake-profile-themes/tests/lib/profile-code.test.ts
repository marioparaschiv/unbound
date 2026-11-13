import { describe, expect, test } from 'bun:test';

import {
	decodeProfileCode,
	encodeProfileCode,
	parseHex,
	stripProfileCode,
} from '~/lib/profile-code';

const EFFECT = '1232073608168472638';

const hide = (text: string) =>
	Array.from(text, (character) => String.fromCodePoint(character.codePointAt(0)! + 0xe0000)).join(
		'',
	);

const compactColor = (value: number) =>
	String.fromCodePoint(0xe0000 + Math.trunc(value / 0x1000), 0xe0000 + (value % 0x1000));

describe('profile code', () => {
	test('round-trips colors and an effect through invisible characters', () => {
		const code = encodeProfileCode({ colors: [0x5865f2, 0xeb459e], effect: EFFECT });

		expect(decodeProfileCode(`Hello there${code}`)).toEqual({
			colors: [0x5865f2, 0xeb459e],
			effect: EFFECT,
		});
	});

	test('hides an effect without colors', () => {
		expect(decodeProfileCode(`bio${encodeProfileCode({ effect: EFFECT })}`)).toEqual({
			colors: undefined,
			effect: EFFECT,
		});
	});

	test('reads the 3y3 code Vencord writes, short colors included', () => {
		expect(decodeProfileCode(`bio ${hide('[#ff0000,#abc]')}`)).toEqual({
			colors: [0xff0000, 0xabc],
			effect: undefined,
		});
	});

	test('reads the compact FPTE colors', () => {
		const both = `bio ${compactColor(0x123456)}​${compactColor(0x654321)}`;

		expect(decodeProfileCode(both).colors).toEqual([0x123456, 0x654321]);
		expect(decodeProfileCode(`bio ${compactColor(0x123456)}`).colors).toEqual([
			0x123456, 0x123456,
		]);
	});

	test('finds nothing in a plain bio', () => {
		expect(decodeProfileCode('just a bio')).toEqual({ colors: undefined, effect: undefined });
		expect(decodeProfileCode(null)).toEqual({});
	});

	test('encodes nothing when there is nothing to hide', () => {
		expect(encodeProfileCode({})).toBe('');
	});

	test('strips the code and its space from a bio', () => {
		const code = encodeProfileCode({ colors: [1, 2], effect: EFFECT });

		expect(stripProfileCode(`Hello there${code}`)).toBe('Hello there');
	});

	test('reads only full hex colors', () => {
		expect(parseHex('#5865F2')).toBe(0x5865f2);
		expect(parseHex('blue')).toBeUndefined();
	});
});
