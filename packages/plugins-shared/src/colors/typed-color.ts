/**
 * @description Reads a typed color as `#RRGGBB`, accepting it with or without the hash and in either case.
 * @param text What was typed.
 * @returns The color, or `undefined` when it is not a six-digit hex color.
 */
export function parseTypedColor(text: string): string | undefined {
	const match = /^#?([0-9a-f]{6})$/i.exec(text.trim());

	return match ? `#${match[1]!.toUpperCase()}` : undefined;
}

export type TypedColorState = 'empty' | 'partial' | 'complete' | 'invalid';

/**
 * @description Says how far a hex code being typed has got, so the field can flag a mistake as soon as it is made rather than when the code is short.
 * @param text What has been typed so far.
 * @returns `empty`, `partial` while it can still become a color, `complete`, or `invalid`.
 */
export function typedColorState(text: string): TypedColorState {
	const trimmed = text.trim();

	if (!trimmed) return 'empty';
	if (parseTypedColor(trimmed)) return 'complete';

	return /^#?[0-9a-f]{0,5}$/i.test(trimmed) ? 'partial' : 'invalid';
}
