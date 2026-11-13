import type { Theme } from '@unbound-app/types';
import uuid from '@unbound-app/utils/uuid';

/** The id prefix of themes made in the theme editor. */
const LOCAL_THEME_PREFIX = 'local.';

const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

/** A colour Discord draws: its `#RRGGBB` hex code and its 0 to 1 alpha. */
export type ParsedColor = {
	hex: string;
	alpha: number;
};

/**
 * @description Mints the id of a theme made in the theme editor.
 * @returns A fresh local theme id.
 */
export function createLocalThemeId(): string {
	return `${LOCAL_THEME_PREFIX}${uuid(16)}`;
}

/**
 * @description Tells whether a theme was made in the theme editor, so it can be edited again.
 * @param id The theme's id.
 * @returns Whether the id is a local theme id.
 */
export function isLocalTheme(id: string): boolean {
	return id.startsWith(LOCAL_THEME_PREFIX);
}

/**
 * @description Parses a `#rrggbb` or `#rrggbbaa` colour, the two forms Discord's colour resolver returns.
 * @param color The colour.
 * @returns Its uppercase `#RRGGBB` code and alpha, or `undefined` for any other form.
 */
export function parseColor(color: string | undefined): ParsedColor | undefined {
	const match = color ? HEX.exec(color) : null;

	if (!match) return;

	const alpha = match[2] ? Number.parseInt(match[2], 16) / 255 : 1;

	return { hex: `#${match[1].toUpperCase()}`, alpha };
}

/**
 * @description Creates a draft to edit, copying a theme so the editor never changes it in place.
 * @param theme The theme to start from, or `null` to start from Discord's colours.
 * @param type The appearance a theme made from scratch is designed against.
 * @returns The draft.
 */
export function createDraft(theme: Theme | null, type: Theme['type']): Theme {
	return theme
		? { ...theme, semantic: { ...theme.semantic }, raw: { ...theme.raw } }
		: { type, semantic: {}, raw: {} };
}

/**
 * @description Writes one colour to tokens, keeping each token's opacity: the draft's own, else the one Discord draws it with.
 * @param draft The draft.
 * @param tokens The token names.
 * @param hex The colour as `#RRGGBB`.
 * @param opacityOf Reads the opacity Discord draws a token with.
 * @returns The new draft.
 */
export function setColor(
	draft: Theme,
	tokens: readonly string[],
	hex: string,
	opacityOf: (token: string) => number | undefined,
): Theme {
	const semantic = { ...draft.semantic };

	for (const token of tokens) {
		const opacity = token in semantic ? semantic[token].opacity : opacityOf(token);

		semantic[token] =
			opacity === undefined || opacity >= 1
				? { type: 'color', value: hex }
				: { type: 'color', value: hex, opacity: Math.round(opacity * 100) / 100 };
	}

	return { ...draft, semantic };
}

/**
 * @description Removes tokens from a draft, so they follow Discord again.
 * @param draft The draft.
 * @param tokens The token names.
 * @returns The new draft, or the same one when it set none of them.
 */
export function resetColor(draft: Theme, tokens: readonly string[]): Theme {
	if (!tokens.some((token) => token in draft.semantic)) {
		return draft;
	}

	const semantic = { ...draft.semantic };

	for (const token of tokens) {
		delete semantic[token];
	}

	return { ...draft, semantic };
}
