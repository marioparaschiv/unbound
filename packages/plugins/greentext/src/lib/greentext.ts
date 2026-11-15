export const DEFAULT_COLOR = '#789922';

const HEX_COLOR = /^#[\da-f]{6}$/i;

export type GreenRange = { start: number; length: number };

/**
 * @description Finds the lines of rendered message text that start with `>`. Discord only quotes `> ` with a space and removes its marker, so any rendered line still starting with `>` is greentext.
 * @param text The message text as Discord drew it.
 * @returns Each such line, without its line break.
 */
export function greenRanges(text: string): GreenRange[] {
	'worklet';
	const ranges: GreenRange[] = [];

	for (let start = 0; start < text.length;) {
		const newline = text.indexOf('\n', start);
		const end = newline === -1 ? text.length : newline;

		if (text[start] === '>' && end - start > 1) {
			ranges.push({ start, length: end - start });
		}

		start = end + 1;
	}

	return ranges;
}

/**
 * @description Reads the stored color, falling back to imageboard green.
 * @param value The stored setting.
 * @returns A `#rrggbb` color.
 */
export function colorOf(value: unknown): string {
	return typeof value === 'string' && HEX_COLOR.test(value) ? value : DEFAULT_COLOR;
}

/**
 * @description Turns a `#rrggbb` color into an opaque ARGB integer, as Android colors are.
 * @param hex The color.
 * @returns The color as a signed 32-bit ARGB integer.
 */
export function argbOf(hex: string): number {
	'worklet';
	return 0xff000000 | Number.parseInt(hex.slice(1), 16) | 0;
}

export default { DEFAULT_COLOR, greenRanges, colorOf, argbOf };
