import { describe, expect, test } from 'bun:test';
import type { Theme } from '@unbound-app/types';

import { parseThemeBundle } from '~/lib/theme-bundle';

describe('parseThemeBundle', () => {
	test('reads a complete theme', () => {
		const theme: Theme = {
			type: 'midnight',
			semantic: { TEXT_NORMAL: { type: 'color', value: '#fcfcfc', opacity: 1 } },
			raw: { PRIMARY_100: '#ffffff' },
			background: { url: 'https://example.com/bg.png', blur: 4 },
		};

		expect(parseThemeBundle(JSON.stringify(theme))).toEqual(theme);
	});

	test('treats missing or malformed sections as empty, like the loader', () => {
		expect(
			parseThemeBundle(
				JSON.stringify({
					semantic: { GOOD: { type: 'raw', value: 'PRIMARY_100' }, BAD: { value: 1 } },
					raw: 'not an object',
					background: { blur: 2 },
				}),
			),
		).toEqual({
			type: 'darker',
			semantic: { GOOD: { type: 'raw', value: 'PRIMARY_100' } },
			raw: {},
		});
	});

	test('refuses a bundle that is not a JSON object', () => {
		expect(() => parseThemeBundle('[]')).toThrow('A theme bundle must be a JSON object.');
		expect(() => parseThemeBundle('{')).toThrow();
	});
});
