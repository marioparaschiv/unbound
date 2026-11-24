import { describe, expect, test } from 'bun:test';

import { toneColor } from '~/lib/colors';

describe('toneColor', () => {
	test('prefers the first theme token, then the next', () => {
		expect(toneColor('red', { RED_360: '#a', RED_400: '#b' })).toBe('#a');
		expect(toneColor('red', { RED_400: '#b' })).toBe('#b');
	});

	test('uses a fixed color when the theme has no token for the tone', () => {
		expect(toneColor('primary', {})).toBe('#5865f2');
		expect(toneColor('muted', {})).toBe('#f2f3f5');
		expect(toneColor('muted', { TEXT_NORMAL: { category: 'semantic' } })).toBe('#f2f3f5');
	});
});
