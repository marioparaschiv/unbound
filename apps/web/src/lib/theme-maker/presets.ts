import type { ThemeBase, ThemeColors } from '~/lib/theme-maker/ramp';
import { DISCORD_RAWS } from '~/lib/theme-maker/scene-colors';
import { BASE_ANCHORS } from '~/lib/theme-maker/ramp';

/** One of Discord's own themes, as a starting point: its base and the three colours it already uses. */
export type ThemePreset = {
	name: string;
	base: ThemeBase;
	colors: ThemeColors;
};

function discordPreset(name: string, base: ThemeBase): ThemePreset {
	return {
		name,
		base,
		// Discord's own anchors, so a preset regenerates Discord's palette as it ships.
		colors: {
			background: DISCORD_RAWS[BASE_ANCHORS[base]] ?? '#000000',
			accent: DISCORD_RAWS.BLURPLE_50 ?? '#5865f2',
			mention: DISCORD_RAWS.YELLOW_300 ?? '#f0b232',
		},
	};
}

/** The preset the theme maker opens on. */
export const DEFAULT_PRESET: ThemePreset = discordPreset('Dark', 'dark');

export const THEME_PRESETS: ThemePreset[] = [
	DEFAULT_PRESET,
	discordPreset('Darker', 'darker'),
	discordPreset('Midnight', 'midnight'),
	discordPreset('Light', 'light'),
];

export default { DEFAULT_PRESET, THEME_PRESETS };
