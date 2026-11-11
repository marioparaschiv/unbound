import type { Addon } from '~/addons/addon';

import type { PickerTheme } from './appearance-picker';

import { backgroundsOf, baseColorOf, paletteOf, themeOf } from './palette';

type BaseTheme = PickerTheme['theme'];

function gradientSwatch(
	theme: BaseTheme,
	name: () => string,
	id: string,
	colors: string[],
): PickerTheme {
	const last = colors.length - 1;

	return {
		type: 'customBackgroundGradient',
		theme,
		getName: name,
		customThemeSettings: {
			colors,
			gradientColorStops: colors.map((_, index) => (index * 100) / last),
			gradientAngle: 135,
			baseMix: 60,
		},
		unboundAddonId: id,
	};
}

/**
 * @description A gradient swatch as flat as Discord's own swatch for a base theme. Every swatch in the carousel is a
 * gradient, so Discord's preview takes the same path between any two and no gradient lingers on a plain one.
 * @param theme The base theme.
 * @param name The swatch's title.
 * @param id The id the swatch is tagged with.
 * @param base The swatch's colour; defaults to Discord's background for the base theme.
 * @returns The picker swatch.
 */
function plainSwatch(
	theme: BaseTheme,
	name: () => string,
	id: string,
	base = baseColorOf(theme),
): PickerTheme {
	return gradientSwatch(theme, name, id, [base, base]);
}

/**
 * @description Describes an addon as a swatch for Discord's theme picker: a theme as a gradient across its
 * background tiers, or plain like Discord's own when they match, and an icon pack as Discord's own swatch for its theme,
 * so its preview keeps Discord's colours.
 * @param addon The theme or icon pack.
 * @param discordTheme Discord's own theme, which an icon pack's swatch stands on.
 * @returns The picker swatch, tagged with the addon's id.
 */
export function pickerThemeOf(addon: Addon, discordTheme: BaseTheme): PickerTheme {
	const theme = themeOf(addon);

	const name = () => addon.name;

	if (!theme) {
		return {
			type: 'standardBackgroundTheme',
			theme: discordTheme,
			getName: name,
			unboundAddonId: addon.id,
		};
	}

	const { base } = paletteOf(addon);

	const backgrounds = backgroundsOf(theme);

	if (backgrounds.length < 2) {
		return plainSwatch(theme.type, name, addon.id, backgrounds[0] ?? base);
	}

	return gradientSwatch(theme.type, name, addon.id, backgrounds);
}
