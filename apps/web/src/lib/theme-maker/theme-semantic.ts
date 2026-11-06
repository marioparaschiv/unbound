import discordColors from '~/lib/theme-maker/discord-colors.json';
import type { ThemeBase } from '~/lib/theme-maker/ramp';

/** One semantic override in a theme's bundle: a raw colour by name, or a literal colour. */
export type SemanticColor = {
	type: 'raw' | 'color';
	/** The raw colour's name for `raw`, a `#rrggbb` hex for `color`. */
	value: string;
	/** Replaces the colour's alpha, from 0 to 1. */
	opacity?: number;
};

/** Semantic token name to its override, as `bundle.semantic` holds them. */
export type SemanticColors = Record<string, SemanticColor>;

/** Discord's token definitions per base, token to `RAW_NAME` or `RAW_NAME@alpha`. */
export const DISCORD_TOKENS: Record<ThemeBase, Record<string, string>> = discordColors.tokens;

/**
 * @description Turns a token definition such as `OPACITY_YELLOW_24@0.239216` into a raw semantic override.
 * @param definition The raw's name, with the alpha after `@`.
 * @returns The override.
 */
export function toRawSemantic(definition: string): SemanticColor {
	const [value = definition, alpha] = definition.split('@');

	return alpha === undefined
		? { type: 'raw', value }
		: { type: 'raw', value, opacity: Number(alpha) };
}

/**
 * @description Points the @mention pill at the mention ramp: Discord's own blurple definitions, with each
 * BLURPLE step swapped for the same YELLOW_NEW step, so the pill keeps Discord's opacity and contrast.
 * @param base The Discord theme the colours build on.
 * @returns The `MENTION_BACKGROUND` and `MENTION_FOREGROUND` overrides.
 */
export function getMentionSemantic(base: ThemeBase): SemanticColors {
	const tokens = DISCORD_TOKENS[base];
	const background = tokens.MENTION_BACKGROUND ?? 'OPACITY_BLURPLE_24@0.239216';
	const foreground = tokens.MENTION_FOREGROUND ?? 'BLURPLE_8';

	return {
		MENTION_BACKGROUND: toRawSemantic(
			background.replace(/^OPACITY_BLURPLE_/, 'OPACITY_YELLOW_'),
		),
		MENTION_FOREGROUND: toRawSemantic(foreground.replace(/^BLURPLE_/, 'YELLOW_NEW_')),
	};
}

export default { DISCORD_TOKENS, toRawSemantic, getMentionSemantic };
