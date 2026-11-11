import { useEffect, useState } from 'react';

import { createPatcher } from '~/patcher/create-patcher';
import type { Addon } from '~/addons/addon';

import { Carousel, Lodash, type PickerTheme, type ThemeSelected } from './appearance-picker';

const Patcher = createPatcher('unbound::design-picker-preview');

type Preview = (addon: Addon | undefined) => void;

/** The addons the watched carousel stands for, swapped when the list changes. */
type Lookup = { byId: Map<string, Addon> };

const byIdOf = (addons: Addon[]) => new Map(addons.map((addon) => [addon.id, addon]));

/**
 * @description Reports the carousel's swatch as it renders and, ahead of the carousel's 180 ms debounce, the moment a
 * scroll crosses onto another swatch. The carousel builds its debounced `onThemeSelected` on its first render, so this
 * must be installed before that render.
 */
function watchCarousel(lookup: Lookup, preview: Preview) {
	const themesOf = new WeakMap<ThemeSelected, PickerTheme[]>();

	// The carousel may be rendering; setting state on another component then is not allowed.
	function report(themes: PickerTheme[], index: number) {
		const addon = lookup.byId.get(themes[index]?.unboundAddonId ?? '');

		queueMicrotask(() => preview(addon));
	}

	const unpatchCarousel = Patcher.before(Carousel, 'default', ({ args }) => {
		const { themes, currentThemeIndex, onThemeSelected } = args[0];

		// Both pickers' carousels pass through here; this one's holds its addons.
		if (!themes.some((theme) => lookup.byId.has(theme.unboundAddonId))) return;

		themesOf.set(onThemeSelected, themes);
		report(themes, currentThemeIndex);
	});

	// Without Discord's lodash, only the carousel's renders report the swatch.
	if (!Lodash) {
		return unpatchCarousel;
	}

	const unpatchDebounce = Patcher.after(Lodash, 'debounce', ({ args: [selected], result }) => {
		const themes = selected && themesOf.get(selected);

		if (!themes) {
			return result;
		}

		return Object.assign(
			(index: number) => {
				report(themesOf.get(selected) ?? themes, index);
				result(index);
			},
			{ cancel: () => result.cancel(), flush: () => result.flush() },
		);
	});

	return () => {
		unpatchCarousel();
		unpatchDebounce();
	};
}

/**
 * @description Follows the swatch Discord's theme picker previews, the moment the carousel crosses onto it, so actions
 * target what the user is looking at rather than what is applied. A swatch that is no addon, such as "Default",
 * previews none.
 * @param addons The addons the swatches stand for.
 * @param fallback The addon to report before the carousel renders.
 * @returns The previewed addon.
 */
function usePreviewedAddon(addons: Addon[], fallback: Addon | undefined): Addon | undefined {
	const [previewed, setPreviewed] = useState(fallback);
	// Installed during this first render, ahead of the carousel's. The patches read `lookup`, which the effect below updates.
	const [{ lookup, unwatch }] = useState(() => {
		const initial: Lookup = { byId: byIdOf(addons) };

		return { lookup: initial, unwatch: watchCarousel(initial, setPreviewed) };
	});

	useEffect(() => {
		lookup.byId = byIdOf(addons);
	}, [lookup, addons]);

	useEffect(() => unwatch, [unwatch]);

	return previewed;
}

export default usePreviewedAddon;
