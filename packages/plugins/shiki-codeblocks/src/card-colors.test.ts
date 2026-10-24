import { describe, expect, test } from 'bun:test';

import { cssColor } from './card-colors';

describe('card colors', () => {
	test('scales a color by the background opacity', () => {
		expect(cssColor('#1e1e1e')).toBe('rgba(30, 30, 30, 1)');
		expect(cssColor('#1e1e1e', 0.5)).toBe('rgba(30, 30, 30, 0.5)');
	});

	test('keeps the alpha a theme color carries', () => {
		expect(cssColor('#ffffff80', 0.5)).toBe('rgba(255, 255, 255, 0.251)');
		expect(cssColor('#fff')).toBe('rgba(255, 255, 255, 1)');
	});

	test('leaves colors it cannot parse alone', () => {
		expect(cssColor('red')).toBe('red');
	});
});
