import { describe, expect, test } from 'bun:test';

import { argb, bubbleAppearance, parseHexColor } from './style';

const reader = (values: Record<string, unknown>) => (key: string) => values[key];

describe('bubble style', () => {
	test('uses the loader style by default, following the theme', () => {
		expect(bubbleAppearance(reader({}), false)).toEqual({
			radius: 10,
			horizontalPadding: 8,
			verticalPadding: 4,
			color: { red: 0, green: 0, blue: 0, alpha: 0.4 },
			ownColor: { red: 0, green: 0, blue: 0, alpha: 0.4 },
		});
		expect(bubbleAppearance(reader({}), true).color).toEqual({
			red: 1,
			green: 1,
			blue: 1,
			alpha: 0.4,
		});
	});

	test('reads custom values, clamped to their limits', () => {
		const appearance = bubbleAppearance(
			reader({
				radius: 99,
				horizontalPadding: '12',
				verticalPadding: -2,
				opacity: 75,
				color: '#f80',
			}),
			false,
		);

		expect(appearance.radius).toBe(32);
		expect(appearance.horizontalPadding).toBe(12);
		expect(appearance.verticalPadding).toBe(0);
		expect(appearance.color).toEqual({ red: 1, green: 136 / 255, blue: 0, alpha: 0.75 });
	});

	test("uses its own color for the user's messages, falling back to the bubble color", () => {
		const custom = bubbleAppearance(
			reader({ color: '#000', ownColor: '#5865f2', opacity: 50 }),
			false,
		);

		expect(custom.ownColor).toEqual({
			red: 88 / 255,
			green: 101 / 255,
			blue: 242 / 255,
			alpha: 0.5,
		});
		expect(
			bubbleAppearance(reader({ color: '#f80', ownColor: 'blue' }), false).ownColor,
		).toEqual({ red: 1, green: 136 / 255, blue: 0, alpha: 0.4 });
	});

	test('ignores colors that are not hex', () => {
		expect(parseHexColor('purple')).toBeUndefined();
		expect(parseHexColor('#12345')).toBeUndefined();
		expect(parseHexColor('0a0B0c')).toEqual({ red: 10 / 255, green: 11 / 255, blue: 12 / 255 });
	});

	test('packs translucent black and white into ARGB', () => {
		expect(argb({ red: 0, green: 0, blue: 0, alpha: 0.4 })).toBe(0x66000000);
		expect(argb({ red: 1, green: 1, blue: 1, alpha: 0.4 })).toBe(0x66ffffff);
	});
});
