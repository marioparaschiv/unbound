import type { ColorRole, ColorSample } from './element-colors';

import { colorKey } from './color-key';

/** A token and the colour it draws now, as a `#rrggbbaa` key. */
export type TokenColor = {
	name: string;
	color: string;
};

/** A sampled colour and the tokens that could draw it, likeliest first. */
export type PickedColor = ColorSample & {
	tokens: string[];
};

type MatchOptions = {
	/** Tokens the draft sets. */
	edited?: ReadonlySet<string>;
	/** Tokens on the editor's first page. */
	curated?: ReadonlySet<string>;
	/** How many tokens to keep. */
	limit?: number;
};

/** The word in the names of tokens drawn in each role, such as `TEXT_MUTED`. */
const ROLE_WORDS: Record<ColorRole, string> = {
	text: 'TEXT',
	icon: 'ICON',
	border: 'BORDER',
	background: 'BACKGROUND',
};

// Sorts a token that has the trait before one that does not.
const before = (a: boolean, b: boolean) => Number(b) - Number(a);

/**
 * @description Keys each token's colour for matching, dropping transparent and unreadable ones.
 * @param colors Each token's name and its colour as Discord spells it.
 * @returns The tokens with their `#rrggbbaa` keys.
 */
export function keyTokenColors(colors: readonly (readonly [string, string])[]): TokenColor[] {
	return colors.flatMap(([name, value]) => {
		const color = colorKey(value);

		return color ? [{ name, color }] : [];
	});
}

/**
 * @description Finds the tokens that could draw a sampled colour. With no exact match, it takes tokens of the same RGB,
 * since some colours are drawn at another opacity, such as the chat colour under a chat background.
 * @param sample The sampled colour.
 * @param tokens Every token's colour, from {@link keyTokenColors}.
 * @param options What to rank first, and how many to keep.
 * @returns The sample with its tokens: edited first, then named for its role, then curated, then by name.
 */
export function matchTokens(
	sample: ColorSample,
	tokens: readonly TokenColor[],
	{ edited = new Set(), curated = new Set(), limit = 4 }: MatchOptions = {},
): PickedColor {
	const rgb = sample.color.slice(0, 7);
	const exact = tokens.filter(({ color }) => color === sample.color);
	const matches = exact.length ? exact : tokens.filter(({ color }) => color.startsWith(rgb));
	const word = ROLE_WORDS[sample.role];
	const names = matches
		.map(({ name }) => name)
		.sort(
			(a, b) =>
				before(edited.has(a), edited.has(b)) ||
				before(a.includes(word), b.includes(word)) ||
				before(curated.has(a), curated.has(b)) ||
				a.localeCompare(b),
		);

	return { ...sample, tokens: names.slice(0, limit) };
}
