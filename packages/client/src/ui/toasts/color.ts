import type { ColorValue } from 'react-native';

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
	if (!color || typeof color !== 'string') return '';

	if (color.startsWith('rgba')) {
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (match) {
			const [, r, g, b] = match;
			return `rgb(${r}, ${g}, ${b})`;
		}
	}

	return color.slice(0, 7);
}

export default { unitToHex, withoutOpacity };
