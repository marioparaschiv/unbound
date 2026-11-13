import { describe, expect, test } from 'bun:test';

import { contrastRatio, readableSurface, unitToHex, withoutOpacity } from '~/ui/toasts/color';

describe('contrastRatio', () => {
	test('spans 1 for one colour to 21 for black on white', () => {
		expect(contrastRatio('#ffffff', '#FFFFFF')).toBe(1);
		expect(contrastRatio('#000000', '#ffffff')).toBe(21);
	});

	test('reads rgb(a) and ignores alpha', () => {
		expect(contrastRatio('rgba(0, 0, 0, 0.1)', '#ffffffcc')).toBe(21);
	});

	test('cannot read other forms', () => {
		expect(contrastRatio('', '#ffffff')).toBeUndefined();
		expect(contrastRatio('red', '#ffffff')).toBeUndefined();
	});
});

describe('readableSurface', () => {
	test("keeps Discord's own surfaces, whose muted text reads on them", () => {
		expect(readableSurface('#0a0a0c', '#81828a')).toBe('#0a0a0c');
		expect(readableSurface('#FFFFFF', '#6c6d76')).toBe('#FFFFFF');
	});

	test('swaps a surface its text does not read on for black or white', () => {
		expect(readableSurface('#FFFFFF', '#81828a')).toBe('#000000');
		expect(readableSurface('#0a0a0c', '#2e3338')).toBe('#ffffff');
	});

	test('keeps a surface it cannot measure', () => {
		expect(readableSurface('', '#81828a')).toBe('');
	});
});

describe('opacity', () => {
	test('appends a fresh alpha to a colour without its old one', () => {
		expect(withoutOpacity('#0a0a0ccc') + unitToHex(0.8)).toBe('#0a0a0ccc');
		expect(withoutOpacity('rgba(1, 2, 3, 0.5)')).toBe('rgb(1, 2, 3)');
	});
});
