import { describe, expect, test } from 'bun:test';

import { parseTypedColor } from './typed-color';

describe('typed colors', () => {
	test('reads six-digit hex codes with or without the hash', () => {
		expect(parseTypedColor('#5865f2')).toBe('#5865F2');
		expect(parseTypedColor(' 000000 ')).toBe('#000000');
	});

	test('rejects anything else', () => {
		expect(parseTypedColor('#fff')).toBeUndefined();
		expect(parseTypedColor('blue')).toBeUndefined();
		expect(parseTypedColor('')).toBeUndefined();
	});
});
