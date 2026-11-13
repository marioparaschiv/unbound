import type { ColorValue } from 'react-native';

/** WCAG AA contrast for body text. */
const MIN_CONTRAST = 4.5;

/** Above this relative luminance, black contrasts more with a colour than white does. */
const LIGHT_LUMINANCE = 0.179;

const RGB = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/;
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i;

function channels(color: string): number[] | undefined {
	const rgb = RGB.exec(color);

	if (rgb) {
		return rgb.slice(1, 4).map(Number);
	}

	const hex = HEX.exec(color);

	return hex ? hex.slice(1, 4).map((pair) => Number.parseInt(pair, 16)) : undefined;
}

function luminance(color: string): number | undefined {
	const rgb = channels(color);

	if (!rgb) return;

	const [r, g, b] = rgb.map((value) => {
		const unit = value / 255;

		return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @description Measures the WCAG contrast ratio between two opaque colours.
 * @param a A `#rrggbb(aa)` or `rgb(a)` colour; any alpha is ignored.
 * @param b Another colour in the same forms.
 * @returns The ratio, from 1 to 21, or `undefined` when either colour cannot be read.
 */
export function contrastRatio(a: string, b: string): number | undefined {
	const first = luminance(a);
	const second = luminance(b);

	if (first === undefined || second === undefined) return;

	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * @description Keeps a surface colour when text reads on it, else swaps in black or white, whichever the text reads on.
 * @param surface The surface colour, without opacity.
 * @param text The text colour drawn on it.
 * @returns The surface to draw.
 */
export function readableSurface(surface: string, text: string): string {
	const ratio = contrastRatio(surface, text);

	if (ratio === undefined || ratio >= MIN_CONTRAST) {
		return surface;
	}

	return (luminance(text) ?? 0) > LIGHT_LUMINANCE ? '#000000' : '#ffffff';
}

/**
 * @description Converts a 0-1 opacity unit into a two-digit hex alpha channel.
 * @param unit The opacity as a fraction between 0 and 1.
 * @returns The alpha as an uppercase-safe two-character hex string.
 */
export function unitToHex(unit: number): string {
	return Math.round(unit * 255)
		.toString(16)
		.padStart(2, '0');
}

/**
 * @description Strips the alpha component from a colour so a fresh opacity can be appended.
 * @param color An `rgb(a)` or hex colour string; a missing theme token resolves to `undefined`.
 * @returns The colour without its alpha, or an empty string when the colour is missing.
 */
export function withoutOpacity(color: ColorValue | undefined): string {
	// A missing theme token resolves to undefined; degrade to an empty string rather than crash the toast.
	if (!color || typeof color !== 'string') {
		return '';
	}

	if (color.startsWith('rgba')) {
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

		if (match) {
			const [, r, g, b] = match;

			return `rgb(${r}, ${g}, ${b})`;
		}
	}

	return color.slice(0, 7);
}
