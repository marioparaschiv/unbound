import { describe, expect, test } from 'bun:test';
import type { Theme } from '@unbound-app/types';

import { resolveThemeColor, withOpacity } from './theme-colors';

const theme: Theme = {
	type: 'darker',
	raw: { BRAND_500: '#ffb000' },
	semantic: {
		BACKGROUND_BASE_LOWER: { type: 'color', value: '#2a0a3a' },
		TEXT_DEFAULT: { type: 'raw', value: 'BRAND_500' },
		TEXT_MUTED: { type: 'raw', value: 'PRIMARY_400', opacity: 0.5 },
		HEADER_PRIMARY: { type: 'color', value: '#00e0ff', opacity: 0.9 },
		BROKEN: { type: 'raw', value: 'MISSING' },
	},
};

describe('resolveThemeColor', () => {
	test('uses colour entries directly', () => {
		expect(resolveThemeColor(theme, 'BACKGROUND_BASE_LOWER')).toBe('#2a0a3a');
	});

	test('follows raw entries into the theme and then Discord', () => {
		expect(resolveThemeColor(theme, 'TEXT_DEFAULT')).toBe('#ffb000');
		expect(resolveThemeColor(theme, 'TEXT_MUTED', { PRIMARY_400: '#808080' })).toBe(
			'#80808080',
		);
	});

	test('applies opacity and keeps Discord colours for unknown or broken entries', () => {
		expect(resolveThemeColor(theme, 'HEADER_PRIMARY')).toBe('#00e0ffe6');
		expect(resolveThemeColor(theme, 'BROKEN')).toBeUndefined();
		expect(resolveThemeColor(theme, 'NOT_THEMED')).toBeUndefined();
		expect(resolveThemeColor(null, 'BACKGROUND_BASE_LOWER')).toBeUndefined();
	});
});

describe('withOpacity', () => {
	test('replaces the alpha of hex colours only', () => {
		expect(withOpacity('#112233', 1)).toBe('#112233ff');
		expect(withOpacity('#11223344', 0)).toBe('#11223300');
		expect(withOpacity('rgb(1, 2, 3)', 0.5)).toBe('rgb(1, 2, 3)');
	});
});
