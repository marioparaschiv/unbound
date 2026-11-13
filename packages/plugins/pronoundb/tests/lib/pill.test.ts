import { describe, expect, test } from 'bun:test';

import { pillColors, readablePill } from '~/lib/pill';

describe('pill colors', () => {
	test('puts white text on dark colors and black text on light ones', () => {
		expect(pillColors('#5865F2')).toEqual({ background: '#5865F2', text: '#ffffff' });
		expect(pillColors('#FEE75C')).toEqual({ background: '#FEE75C', text: '#000000' });
	});

	test('drops the alpha channel and accepts a missing hash', () => {
		expect(pillColors('ff4d6d80')).toEqual({ background: '#ff4d6d', text: '#ffffff' });
	});

	test('keeps Discord colors for unreadable values', () => {
		expect(pillColors('')).toBeUndefined();
		expect(pillColors('red')).toBeUndefined();
	});
});

describe('theme pill', () => {
	test("keeps Discord's text color while it reads well", () => {
		expect(readablePill('#C9CDFB', '#2E3035')).toEqual({
			background: '#C9CDFB',
			text: '#2E3035',
		});
	});

	test('switches to black or white text when a theme makes them too close', () => {
		expect(readablePill('#FFB6D9', '#F4C2DA')).toEqual({
			background: '#FFB6D9',
			text: '#000000',
		});
		expect(readablePill('#3A0D24', '#4A1830')).toEqual({
			background: '#3A0D24',
			text: '#ffffff',
		});
		expect(readablePill('pink', '#ffffff')).toBeUndefined();
	});
});
