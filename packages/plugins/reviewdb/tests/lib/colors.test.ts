import { describe, expect, mock, test } from 'bun:test';

mock.module('@unbound-app/api', () => ({ metro: { common: { Theme: { colors: {} } } } }));

const { getReviewColors, themedReviewColors } = await import('~/lib/colors');

describe('review colors', () => {
	const base = getReviewColors();

	test('tints the backgrounds with the primary color and the send button with the accent', () => {
		const themed = themedReviewColors(base, [0xff0000, 0x00ff00]);

		expect(themed.accent).toBe('#00ff00');
		expect(themed.page).not.toBe(base.page);
		expect(themed.page.startsWith('#')).toBe(true);
		expect(themed.text).toBe(base.text);
	});

	test('keeps text on the accent readable', () => {
		expect(themedReviewColors(base, [0x111111, 0xffe4f0]).accentText).toBe('#000000');
		expect(themedReviewColors(base, [0x111111, 0x3a0ca3]).accentText).toBe('#ffffff');
	});

	test('keeps the palette without two readable colors', () => {
		expect(themedReviewColors(base, undefined)).toBe(base);
		expect(themedReviewColors(base, [0xff0000])).toBe(base);
	});
});
