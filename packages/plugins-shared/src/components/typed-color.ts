/**
 * @description Reads a typed color as `#RRGGBB`, accepting it with or without the hash and in either case.
 * @param text What was typed.
 * @returns The color, or `undefined` when it is not a six-digit hex color.
 */
export function parseTypedColor(text: string): string | undefined {
	const match = /^#?([0-9a-f]{6})$/i.exec(text.trim());

	return match ? `#${match[1]!.toUpperCase()}` : undefined;
}
