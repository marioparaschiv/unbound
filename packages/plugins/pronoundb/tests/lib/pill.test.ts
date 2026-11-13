import { describe, expect, test } from 'bun:test';

import { pillColors } from '~/lib/pill';

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
