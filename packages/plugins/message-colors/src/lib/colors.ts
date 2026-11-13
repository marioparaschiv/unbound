export const COLOR_PATTERN =
	/(?<![\w#])#(?:[\da-f]{6}|(?=[\da-f]{0,2}[a-f])[\da-f]{3})\b|\b(?:rgb|hsl)a?\(\s*[\d.]+%?\s*[,\s]\s*[\d.]+%?\s*[,\s]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)/giu;

function clamp(value: number, max = 255): number {
	return Math.round(Math.min(Math.max(value, 0), max));
}

function hslToRgb(hue: number, saturation: number, lightness: number): number[] {
	const s = saturation / 100;
	const l = lightness / 100;
	const chroma = (1 - Math.abs(2 * l - 1)) * s;
	const h = (((hue % 360) + 360) % 360) / 60;
	const x = chroma * (1 - Math.abs((h % 2) - 1));
	const [r, g, b] =
		h < 1
			? [chroma, x, 0]
			: h < 2
				? [x, chroma, 0]
				: h < 3
					? [0, chroma, x]
					: h < 4
						? [0, x, chroma]
						: h < 5
							? [x, 0, chroma]
							: [chroma, 0, x];
	const m = l - chroma / 2;

	return [r, g, b].map((channel) => clamp((channel + m) * 255));
}

function channels(text: string): number[] {
	return (text.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
}

/**
 * @description Reads a color written in a message as a 24-bit RGB value.
 * @param text `#rgb`, `#rrggbb`, `rgb(…)` or `hsl(…)`, with or without alpha.
 * @returns The color, or `undefined` when the text is not one.
 */
export function parseColor(text: string): number | undefined {
	const lower = text.toLowerCase();

	if (lower.startsWith('#')) {
		const hex =
			lower.length === 4
				? [...lower.slice(1)].map((digit) => digit + digit).join('')
				: lower.slice(1);

		return /^[\da-f]{6}$/.test(hex) ? Number.parseInt(hex, 16) : undefined;
	}

	const values = channels(lower);

	if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) return undefined;

	const [r, g, b] = lower.startsWith('hsl')
		? hslToRgb(values[0]!, values[1]!, values[2]!)
		: values.map((value) => clamp(value));

	return (r! << 16) | (g! << 8) | b!;
}

/**
 * @description Writes a 24-bit RGB value as `#rrggbb`.
 * @param color The color.
 * @returns The hex string.
 */
export function toHex(color: number): string {
	return `#${color.toString(16).padStart(6, '0')}`;
}

export default { parseColor, toHex };
