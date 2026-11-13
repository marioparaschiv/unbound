const HEX_COLOR = /^#?([\da-f]{6})([\da-f]{2})?$/i;
const LIGHT_LUMA = 150;
const DARK_TEXT = '#000000';
const LIGHT_TEXT = '#ffffff';

export type PillColors = { background: string; text: string };

/**
 * @description Picks the pronoun pill's colors from the color the user chose: that color behind black or white text, whichever reads better.
 * @param color A `#RRGGBB` color.
 * @returns The background and text colors, or `undefined` for an unreadable color, which keeps Discord's.
 */
export function pillColors(color: string): PillColors | undefined {
	const match = HEX_COLOR.exec(color.trim());

	if (!match) return undefined;

	const value = Number.parseInt(match[1]!, 16);
	const luma =
		(((value >> 16) & 0xff) * 299 + ((value >> 8) & 0xff) * 587 + (value & 0xff) * 114) / 1000;

	return { background: `#${match[1]}`, text: luma > LIGHT_LUMA ? DARK_TEXT : LIGHT_TEXT };
}

function luminance(hex: string): number | undefined {
	const match = HEX_COLOR.exec(hex.trim());

	if (!match) return undefined;

	const value = Number.parseInt(match[1]!, 16);
	const [r, g, b] = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) => {
		const c = channel / 255;

		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const MIN_CONTRAST = 3;

/**
 * @description Keeps Discord's tag text color on a theme's tag background while it stays readable, and swaps in black or white
 * when a theme makes the two too close.
 * @param background The tag background, `#RRGGBB`.
 * @param text Discord's tag text color, `#RRGGBB`.
 * @returns The background and the text color to use, or `undefined` when either color is unreadable.
 */
export function readablePill(background: string, text: string): PillColors | undefined {
	const back = luminance(background);
	const front = luminance(text);

	if (back === undefined || front === undefined) return undefined;

	const contrast = (Math.max(back, front) + 0.05) / (Math.min(back, front) + 0.05);

	if (contrast >= MIN_CONTRAST) return { background, text };

	return pillColors(background);
}

export default { pillColors, readablePill };
