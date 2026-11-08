import { useEffect, useState } from 'react';

import { createPatcher } from '~/patcher/create-patcher';

import { Backdrop, type PickerTheme } from './appearance-picker';

const Patcher = createPatcher('unbound::design-picker-colours');

/** The swatch ids whose backdrop is drawn in their true colours, swapped when the list changes. */
type Target = { ids: Set<string> };

function isOwn(target: Target, theme: PickerTheme | undefined) {
	return theme?.type === 'customBackgroundGradient' && target.ids.has(theme.unboundAddonId);
}

/**
 * @description Draws the backdrop behind the preview in the swatch's own colours. Discord dims a gradient's backdrop to
 * under a quarter of its brightness, which hides a theme's real background. Discord's own swatches carry no Unbound id,
 * so they convert as before; the swatches themselves stay Discord's, unpatched.
 */
function watchBackdrop(target: Target) {
	return Patcher.after(Backdrop, 'convertThemesToAnimatedThemes', ({ args: [themes], result }) =>
		result.map((backdrop, index) => {
			const theme = themes[index];
			const colors = theme?.customThemeSettings?.colors;

			if (!colors?.length || !isOwn(target, theme)) {
				return backdrop;
			}

			// Discord pads the stops with the last colour, so a stop past the swatch's colours takes the last one.
			return {
				...backdrop,
				colors: backdrop.colors.map((stop, at) => ({
					...stop,
					hex: colors[Math.min(at, colors.length - 1)],
				})),
			};
		}),
	);
}

/**
 * @description Shows the page behind the preview of Discord's theme picker undimmed for the given swatches.
 * Installed during the first render, ahead of the backdrop's, which converts the swatches once.
 * @param ids The ids of the swatches to draw in their true colours.
 */
function useTrueColours(ids: string[]) {
	const [{ target, unwatch }] = useState(() => {
		const initial: Target = { ids: new Set(ids) };

		return { target: initial, unwatch: watchBackdrop(initial) };
	});

	useEffect(() => {
		target.ids = new Set(ids);
	}, [target, ids]);

	useEffect(() => unwatch, [unwatch]);
}

export default useTrueColours;
