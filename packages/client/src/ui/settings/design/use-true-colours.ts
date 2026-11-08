import { useEffect, useState } from 'react';

import { createPatcher } from '~/patcher/create-patcher';

import { Backdrop, ThemedGradient, type PickerTheme } from './appearance-picker';
import useStyles from './use-true-colours.style';

const Patcher = createPatcher('unbound::design-picker-colours');

/** The swatch ids drawn in their true colours, swapped when the list changes. */
type Target = { ids: Set<string> };

function isOwn(target: Target, theme: PickerTheme | undefined) {
	return theme?.type === 'customBackgroundGradient' && target.ids.has(theme.unboundAddonId);
}

/**
 * @description Draws this picker's gradient swatches, and the backdrop behind the preview, in the swatch's own colours.
 * Discord dims a gradient's backdrop to under a quarter of its brightness and its swatch by 20%, which hides a theme's
 * real background.
 */
function watchGradients(target: Target) {
	const unpatchBackdrop = Patcher.after(
		Backdrop,
		'convertThemesToAnimatedThemes',
		({ args: [themes], result }) =>
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

	const unpatchSwatch = Patcher.before(ThemedGradient, 'CustomThemedGradient', ({ args }) => {
		const [props, ...rest] = args;

		if (!props.mix || !isOwn(target, props.customTheme)) return;

		// Runs in the swatch's render. A swatch keeps its theme for life, so this hook runs on every render or none.
		const styles = useStyles();

		return [
			{ ...props, mix: false, componentStyles: [props.componentStyles, styles.swatch] },
			...rest,
		];
	});

	return () => {
		unpatchBackdrop();
		unpatchSwatch();
	};
}

/**
 * @description Shows the given swatches of Discord's theme picker, and the page behind its preview, undimmed.
 * Installed during the first render, ahead of the backdrop's, which converts the swatches once.
 * @param ids The ids of the swatches to draw in their true colours.
 */
function useTrueColours(ids: string[]) {
	const [{ target, unwatch }] = useState(() => {
		const initial: Target = { ids: new Set(ids) };

		return { target: initial, unwatch: watchGradients(initial) };
	});

	useEffect(() => {
		target.ids = new Set(ids);
	}, [target, ids]);

	useEffect(() => unwatch, [unwatch]);
}

export default useTrueColours;
