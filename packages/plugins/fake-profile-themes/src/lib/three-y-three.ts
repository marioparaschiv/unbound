const TAG_OFFSET = 0xe0000;
const TAG_START = 0xe0020;
const TAG_END = 0xe007f;
const COLORS = /\[#([a-fA-F0-9]{1,6}),#([a-fA-F0-9]{1,6})\]/;

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * @description Reads a `#rrggbb` color.
 * @param color The color.
 * @returns The color as a number, or `undefined` when it is not one.
 */
export function parseHex(color: string): number | undefined {
	return /^#[a-fA-F0-9]{6}$/.test(color.trim())
		? Number.parseInt(color.trim().slice(1), 16)
		: undefined;
}

/**
 * @description Hides a profile's two theme colors in invisible characters to paste at the end of a bio, the 3y3 code
 * Vencord's FakeProfileThemes reads.
 * @param primary The primary color.
 * @param accent The accent color.
 * @returns A space and the invisible code.
 */
export function encodeThemeColors(primary: number, accent: number): string {
	const hidden = Array.from(`[${hex(primary)},${hex(accent)}]`)
		.map((character) => String.fromCodePoint(character.codePointAt(0)! + TAG_OFFSET))
		.join('');

	return ` ${hidden}`;
}

/**
 * @description Finds theme colors hidden in a bio with the 3y3 code.
 * @param bio The bio.
 * @returns The primary and accent colors, or `undefined` when the bio hides none.
 */
export function decodeThemeColors(bio: string | null | undefined): [number, number] | undefined {
	if (!bio) return;

	let hidden = '';

	for (const character of bio) {
		const point = character.codePointAt(0)!;

		if (point >= TAG_START && point <= TAG_END)
			hidden += String.fromCodePoint(point - TAG_OFFSET);
	}

	const match = COLORS.exec(hidden);

	return match ? [Number.parseInt(match[1]!, 16), Number.parseInt(match[2]!, 16)] : undefined;
}

/**
 * @description Removes the 3y3 code from a bio, with the space before it, so it does not show as boxes.
 * @param bio The bio.
 * @returns The bio without the hidden characters.
 */
export function stripThemeColors(bio: string): string {
	return bio.replace(/\s?[\u{E0020}-\u{E007F}]+/gu, '');
}
