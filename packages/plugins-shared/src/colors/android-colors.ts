/**
 * @description Converts a `#rrggbb` color to the signed ARGB `int` Android drawables and text spans take.
 * @param hex The color.
 * @returns The opaque color as a signed 32-bit integer.
 */
export function androidColor(hex: string): number {
	return 0xff000000 | Number.parseInt(hex.slice(1, 7), 16) | 0;
}

/**
 * @description Converts an ARGB `int` read from Android back to `#rrggbb`, dropping its alpha.
 * @param color The signed or unsigned color.
 * @returns The lowercase hex color.
 */
export function hexColor(color: number): string {
	return `#${((color >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
}

export default { androidColor, hexColor };
