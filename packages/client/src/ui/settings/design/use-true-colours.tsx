import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import noop from '@unbound-app/utils/noop';

import { createPatcher } from '~/patcher/create-patcher';
import { findComponent } from '~/utils/react';

import { Backdrop, SelectorItem, type PickerTheme } from './appearance-picker';
import SwatchGradient from './swatch-gradient';

const Patcher = createPatcher('unbound::design-picker-colours');

/** The swatch ids drawn in their true colours, swapped when the list changes. */
type Target = { ids: Set<string> };

type RingProps = { children: ReactNode[] };

type BackgroundProps = { item?: PickerTheme };

function isOwn(target: Target, theme: PickerTheme | undefined) {
	return theme?.type === 'customBackgroundGradient' && target.ids.has(theme.unboundAddonId);
}

/**
 * @description Draws the backdrop behind the preview in the swatch's own colours. Discord dims a gradient's backdrop to
 * under a quarter of its brightness, which hides a theme's real background. Discord's own swatches carry no Unbound id,
 * so they convert as before.
 */
function watchBackdrop(target: Target) {
	if (!Backdrop) {
		return noop;
	}

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

const isBackground = (node: ReactNode) =>
	Boolean((node as ReactElement<BackgroundProps> | null)?.props?.item);

/**
 * @description Swaps the background inside this picker's swatches for {@link SwatchGradient}. Discord's selection
 * ring, press handling and its gradient component are left as they are; Discord's own swatches render untouched.
 */
function watchSwatches(target: Target) {
	return Patcher.after(SelectorItem, 'default', ({ args: [props], result }) => {
		if (!isOwn(target, props.themePreset)) {
			return result;
		}

		const ring = findComponent<RingProps>(
			result,
			(element) =>
				Array.isArray(element.props.children) && element.props.children.some(isBackground),
		);

		if (!ring) {
			return result;
		}

		// The item may hand back a cached tree, so the children are replaced rather than edited in place.
		ring.props.children = ring.props.children.map((child) =>
			isBackground(child) ? (
				<SwatchGradient key='unbound-swatch' item={props.themePreset} />
			) : (
				child
			),
		);

		return result;
	});
}

/**
 * @description Shows this picker's theme swatches, and the page behind its preview, undimmed.
 * Installed during the first render, ahead of the backdrop's, which converts the swatches once, and the swatches'.
 * @param ids The ids of the swatches to draw in their true colours.
 */
function useTrueColours(ids: string[]) {
	const [{ target, unwatch }] = useState(() => {
		const initial: Target = { ids: new Set(ids) };

		const unwatchBackdrop = watchBackdrop(initial);
		const unwatchSwatches = watchSwatches(initial);

		return {
			target: initial,
			unwatch: () => {
				unwatchBackdrop();
				unwatchSwatches();
			},
		};
	});

	useEffect(() => {
		target.ids = new Set(ids);
	}, [target, ids]);

	useEffect(() => unwatch, [unwatch]);
}

export default useTrueColours;
