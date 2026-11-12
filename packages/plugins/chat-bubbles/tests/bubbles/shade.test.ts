import { describe, expect, test } from 'bun:test';

import { hexColor, shadeColor } from '~/bubbles/shade';
import { parseHexColor } from '~/bubbles/style';

const shade = (hex: string, share: number) => hexColor(shadeColor(parseHexColor(hex)!, share));

describe('theme shade', () => {
	test('takes a share of full lightness away, keeping the hue', () => {
		expect(shade('#FBFBFB', 0.08)).toBe('#E7E7E7');
		expect(shade('#1A1A1E', 0.08)).toBe('#070708');
		expect(shade('#5865F2', 0.1)).toBe('#2939EE');
	});

	test('turns a color too dark to shade lighter instead', () => {
		expect(shade('#000000', 0.08)).toBe('#141414');
	});

	test('writes a color as #RRGGBB', () => {
		expect(hexColor({ red: 1, green: 136 / 255, blue: 0 })).toBe('#FF8800');
	});
});
