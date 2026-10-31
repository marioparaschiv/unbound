import { describe, expect, test } from 'bun:test';

import { parseTypedColor, typedColorState } from './typed-color';

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

describe('typing a color', () => {
	test('follows the code as it is typed', () => {
		expect(typedColorState('')).toBe('empty');
		expect(typedColorState('#58')).toBe('partial');
		expect(typedColorState('5865f2')).toBe('complete');
	});

	test('flags a mistake straight away', () => {
		expect(typedColorState('#58g')).toBe('invalid');
		expect(typedColorState('#5865F2A')).toBe('invalid');
	});
});
