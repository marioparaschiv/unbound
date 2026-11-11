import { describe, expect, test } from 'bun:test';
import type { Theme } from '@unbound-app/types';

import { resolveChatBackground } from '~/themes/chat-background';

const theme: Theme = {
	type: 'darker',
	semantic: {},
	raw: {},
	background: { url: 'https://example.com/theme.png', blur: 6 },
};

const custom = { url: 'https://example.com/mine.png', blur: 2, opacity: 0.8 };

describe('resolveChatBackground', () => {
	test("draws the theme's recommendation, at half opacity when it names none", () => {
		expect(resolveChatBackground(theme, { ...custom, source: 'theme' })).toEqual({
			url: 'https://example.com/theme.png',
			blur: 6,
			opacity: 0.5,
		});
	});

	test("draws the user's own image instead when they pick custom", () => {
		expect(resolveChatBackground(theme, { ...custom, source: 'custom' })).toEqual(custom);
	});

	test('draws nothing when turned off, without a recommendation, or without a custom URL', () => {
		expect(resolveChatBackground(theme, { ...custom, source: 'off' })).toBeUndefined();
		expect(
			resolveChatBackground(
				{ ...theme, background: undefined },
				{ ...custom, source: 'theme' },
			),
		).toBeUndefined();
		expect(resolveChatBackground(null, { ...custom, source: 'theme' })).toBeUndefined();
		expect(
			resolveChatBackground(theme, { ...custom, url: '', source: 'custom' }),
		).toBeUndefined();
	});

	test('keeps opacity between 0 and 1 and blur at or above 0', () => {
		expect(
			resolveChatBackground(theme, { url: 'x', blur: -3, opacity: 4, source: 'custom' }),
		).toEqual({ url: 'x', blur: 0, opacity: 1 });
	});
});
