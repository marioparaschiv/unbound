import type { Addon } from '~/addons/addon';

import type { PickerTheme } from './appearance-picker';

import { baseColorOf, paletteOf, themeOf } from './palette';

type BaseTheme = PickerTheme['theme'];

/**
 * @description A gradient swatch as flat as Discord's own swatch for a base theme. Every swatch in the carousel is a
 * gradient, so Discord's preview takes the same path between any two and no gradient lingers on a plain one.
 * @param theme The base theme.
 * @param name The swatch's title.
 * @param id The id the swatch is tagged with.
 * @returns The picker swatch.
 */
export function plainSwatch(theme: BaseTheme, name: () => string, id: string): PickerTheme {
	const base = baseColorOf(theme);

	return {
		type: 'customBackgroundGradient',
		theme,
		getName: name,
		customThemeSettings: {
			colors: [base, base],
			gradientColorStops: [0, 100],
			gradientAngle: 135,
			baseMix: 60,
		},
		unboundAddonId: id,
	};
}

/**
 * @description Describes an addon as a swatch for Discord's theme picker: a custom gradient from its
 * accent into its base, which Discord also uses to tint the live preview, or a plain one when it sets no colours.
 * @param addon The theme or icon pack.
 * @param index Its position in the carousel, so neighbouring icon packs get different tints.
 * @returns The picker swatch, tagged with the addon's id.
 */
export function pickerThemeOf(addon: Addon, index: number): PickerTheme {
	const { base, accent } = paletteOf(addon, index);
	const theme = themeOf(addon);

	// A theme that sets no colours is its base theme.
	if (
		theme &&
		!Object.keys(theme.semantic ?? {}).length &&
		!Object.keys(theme.raw ?? {}).length
	) {
		return plainSwatch(theme.type, () => addon.name, addon.id);
	}

	return {
		type: 'customBackgroundGradient',
		theme: theme?.type ?? 'darker',
		getName: () => addon.name,
		customThemeSettings: {
			colors: [accent, base],
			gradientColorStops: [0, 100],
			gradientAngle: 135,
			baseMix: 60,
		},
		unboundAddonId: addon.id,
	};
}
