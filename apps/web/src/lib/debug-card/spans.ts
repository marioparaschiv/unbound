/** One coloured run of text on the card. */
export type Span = { text: string; color: string };

export const COLORS = {
	background: '#111214',
	border: '#2b2d31',
	titleBar: '#1e1f22',
	label: '#949ba4',
	value: '#f2f3f5',
	accent: '#a78bfa',
	dim: '#949ba4',
	good: '#22c55e',
	warn: '#eab308',
	bad: '#ef4444',
};

/**
 * @description Colours text in the value colour.
 * @param text The text.
 * @returns The span.
 */
export function value(text: string): Span {
	return { text, color: COLORS.value };
}

/**
 * @description Colours text in the dimmed colour.
 * @param text The text.
 * @returns The span.
 */
export function dim(text: string): Span {
	return { text, color: COLORS.dim };
}

/**
 * @description Colours text in the warning colour.
 * @param text The text.
 * @returns The span.
 */
export function warn(text: string): Span {
	return { text, color: COLORS.warn };
}

/**
 * @description Colours text in the accent colour.
 * @param text The text.
 * @returns The span.
 */
export function accent(text: string): Span {
	return { text, color: COLORS.accent };
}

/**
 * @description Joins the parts that are set with the card's ` · ` separator.
 * @param parts The parts; empty and `undefined` ones are skipped.
 * @returns The joined text.
 */
export function joined(parts: (string | undefined)[]): string {
	return parts.filter(Boolean).join(' · ');
}

const EDGE_BLANKS = /^[\s\p{Cc}\p{Cf}]+|[\s\p{Cc}\p{Cf}]+$/gu;

/**
 * @description Strips whitespace and invisible characters from the ends of reported names, dropping names left empty.
 * @param names The names, as a device reported them.
 * @returns The names to show.
 */
export function cleanNames(names: readonly string[]): string[] {
	return names.map((name) => name.replace(EDGE_BLANKS, '')).filter(Boolean);
}
