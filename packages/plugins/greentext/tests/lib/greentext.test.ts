import { describe, expect, test } from 'bun:test';

import { argbOf, colorOf, DEFAULT_COLOR, greenRanges } from '~/lib/greentext';

describe('greenRanges', () => {
	test('finds each line that starts with >', () => {
		const text = '>be me\nnormal line\n>>12345 lol\n>';

		expect(greenRanges(text)).toEqual([
			{ start: 0, length: 6 },
			{ start: 19, length: 11 },
		]);
	});

	test('ignores > inside a line and text without any', () => {
		expect(greenRanges('a > b\nno quote')).toEqual([]);
	});
});

describe('colorOf', () => {
	test('keeps a valid color and falls back otherwise', () => {
		expect(colorOf('#ff0000')).toBe('#ff0000');
		expect(colorOf('green')).toBe(DEFAULT_COLOR);
		expect(colorOf(undefined)).toBe(DEFAULT_COLOR);
	});
});

describe('argbOf', () => {
	test('makes an opaque signed ARGB integer', () => {
		expect(argbOf('#789922')).toBe(0xff789922 | 0);
	});
});
