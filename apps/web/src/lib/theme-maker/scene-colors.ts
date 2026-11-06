import {
	DISCORD_TOKENS,
	type SemanticColor,
	type SemanticColors,
} from '~/lib/theme-maker/theme-semantic';
import type { SceneColors, SceneElement } from '~/lib/theme-maker/scene-tokens';
import type { RawColors, ThemeBase } from '~/lib/theme-maker/ramp';
import discordColors from '~/lib/theme-maker/discord-colors.json';
import { SCENE_TOKENS } from '~/lib/theme-maker/scene-tokens';

/** Discord's raw colours the theme maker ships: the generator's ramps and the raws the scene tokens use. */
export const DISCORD_RAWS: RawColors = discordColors.raw;

function withOpacity(hex: string, opacity: number | undefined) {
	if (opacity === undefined) {
		return hex;
	}

	const byte = Math.round(Math.min(1, Math.max(0, opacity)) * 255);

	return hex.slice(0, 7) + byte.toString(16).padStart(2, '0');
}

/**
 * @description Resolves one token definition such as `OPACITY_YELLOW_8@0.0784314` against a raw palette.
 * @param definition The raw's name, with the alpha Discord applies after `@`.
 * @param raws The theme's raws; a raw it lacks falls back to Discord's own.
 * @returns The colour as `#rrggbb` or `#rrggbbaa`.
 */
export function resolveDefinition(definition: string, raws: RawColors): string {
	const [name = definition, alpha] = definition.split('@');
	const hex = raws[name] ?? DISCORD_RAWS[name] ?? '#000000';

	return withOpacity(hex, alpha === undefined ? undefined : Number(alpha));
}

/**
 * @description Resolves a semantic override the way the loader does: a raw by name or a literal, its opacity
 * replacing the alpha.
 * @param entry The override.
 * @param raws The theme's raws; a raw it lacks falls back to Discord's own.
 * @returns The colour as `#rrggbb` or `#rrggbbaa`.
 */
export function resolveSemantic(entry: SemanticColor, raws: RawColors): string {
	const hex =
		entry.type === 'raw'
			? (raws[entry.value] ?? DISCORD_RAWS[entry.value] ?? '#000000')
			: entry.value;

	return withOpacity(hex, entry.opacity);
}

/**
 * @description Resolves a semantic token: the theme's override first, then the base's definition.
 * @param token The token's name.
 * @param raws The theme's raws.
 * @param base The Discord theme whose definitions apply.
 * @param semantic The theme's semantic overrides.
 * @returns The colour as `#rrggbb` or `#rrggbbaa`.
 */
export function resolveToken(
	token: string,
	raws: RawColors,
	base: ThemeBase = 'dark',
	semantic: SemanticColors = {},
): string {
	const override = semantic[token];

	if (override) {
		return resolveSemantic(override, raws);
	}

	return resolveDefinition(DISCORD_TOKENS[base][token] ?? token, raws);
}

/**
 * @description Paints every scene element with its token, resolved for a Discord theme through a raw palette.
 * @param raws The generated raws.
 * @param base The Discord theme whose token definitions apply.
 * @param semantic The theme's semantic overrides, applied before the base's definitions.
 * @returns A lookup from scene element to its CSS colour.
 */
export function getSceneColors(
	raws: RawColors,
	base: ThemeBase = 'dark',
	semantic: SemanticColors = {},
): SceneColors {
	const colors = new Map<SceneElement, string>();

	return (element) => {
		let color = colors.get(element);

		if (color === undefined) {
			color = resolveToken(SCENE_TOKENS[element], raws, base, semantic);
			colors.set(element, color);
		}

		return color;
	};
}

export default { DISCORD_RAWS, resolveDefinition, resolveSemantic, resolveToken, getSceneColors };
