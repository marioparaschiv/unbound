import { describe, expect, test } from 'bun:test';

import { mentionPaint, parseColorDescription } from '~/native/ios/mention';

describe('mention highlight', () => {
	test('reads RGB and gray color descriptions', () => {
		expect(parseColorDescription('UIExtendedSRGBColorSpace 0.941 0.696551 0.195728 1')).toEqual(
			{
				red: 0.941,
				green: 0.696551,
				blue: 0.195728,
				alpha: 1,
			},
		);
		expect(parseColorDescription('UIExtendedGrayColorSpace 0.5 0.25')).toEqual({
			red: 0.5,
			green: 0.5,
			blue: 0.5,
			alpha: 0.25,
		});
		expect(parseColorDescription('<UIDynamicProviderColor: 0x1>')).toBeUndefined();
		expect(parseColorDescription(null)).toBeUndefined();
	});

	const bubble = { red: 0, green: 0, blue: 1, alpha: 0.5 };
	const bar = { red: 1, green: 1, blue: 0, alpha: 1 };

	test("outlines in Discord's bar color at the mention opacity and width, tinting the fill", () => {
		const { color, border } = mentionPaint(bubble, bar, {
			color: undefined,
			alpha: 0.5,
			width: 0.5,
			tint: 0.15,
		});

		expect(color.red).toBeCloseTo(0.15);
		expect(color.green).toBeCloseTo(0.15);
		expect(color.blue).toBeCloseTo(0.85);
		expect(color.alpha).toBe(0.5);
		expect(border).toEqual({ color: { red: 1, green: 1, blue: 0, alpha: 0.5 }, width: 0.5 });
	});

	test('uses the custom mention color over the bar', () => {
		const custom = { red: 1, green: 0, blue: 0 };

		expect(mentionPaint(bubble, bar, { color: custom, alpha: 0.2, width: 1, tint: 0 })).toEqual(
			{ color: bubble, border: { color: { ...custom, alpha: 0.2 }, width: 1 } },
		);
	});
});
