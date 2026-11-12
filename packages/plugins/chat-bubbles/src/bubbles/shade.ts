import type { BubbleColor } from '~/bubbles/style';

type Rgb = Omit<BubbleColor, 'alpha'>;

function toHsl({ red, green, blue }: Rgb) {
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const lightness = (max + min) / 2;
	const delta = max - min;

	if (delta === 0) return { hue: 0, saturation: 0, lightness };

	const saturation = delta / (1 - Math.abs(2 * lightness - 1));
	const sector =
		max === red
			? ((green - blue) / delta) % 6
			: max === green
				? (blue - red) / delta + 2
				: (red - green) / delta + 4;

	return { hue: (sector * 60 + 360) % 360, saturation, lightness };
}

function fromHsl(hue: number, saturation: number, lightness: number): Rgb {
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const base = lightness - chroma / 2;
	const [red, green, blue] = [
		[chroma, second, 0],
		[second, chroma, 0],
		[0, chroma, second],
		[0, second, chroma],
		[second, 0, chroma],
		[chroma, 0, second],
	][Math.floor(hue / 60) % 6]!;

	return { red: red! + base, green: green! + base, blue: blue! + base };
}

/**
 * @description Shades a color darker by a share of full lightness, keeping its hue; a color too dark to shade, such as black, turns lighter by the same share instead.
 * @param color The color to shade.
 * @param share How much lightness to take away, from 0 to 1.
 * @returns The shaded color.
 */
export function shadeColor(color: Rgb, share: number): Rgb {
	const { hue, saturation, lightness } = toHsl(color);
	const shaded = lightness >= share ? lightness - share : lightness + share;

	return fromHsl(hue, saturation, Math.min(1, shaded));
}

/**
 * @description Writes a color as `#RRGGBB`.
 * @param color The color.
 * @returns The hex string.
 */
export function hexColor({ red, green, blue }: Rgb): string {
	const channel = (value: number) =>
		Math.round(value * 255)
			.toString(16)
			.padStart(2, '0');

	return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

export default { hexColor, shadeColor };
