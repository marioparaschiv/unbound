import { useEffect, useState } from 'react';

import { createPatcher } from '~/patcher/create-patcher';

import { Carousel } from './appearance-picker';

const Patcher = createPatcher('unbound::design-picker-select');

type Select = (id: string) => void;

/** The swatch ids the watched carousel stands for and what to do with the one it settles on, swapped on change. */
type Target = { ids: Set<string>; select: Select };

/**
 * @description Reports each swatch the carousel settles on. Discord's picker without a Save button only saves when
 * its page closes, so selecting is reported here instead. The carousel's first render is its starting swatch, not a pick.
 */
function watchCarousel(target: Target) {
	let last: number | undefined;

	return Patcher.before(Carousel, 'default', ({ args }) => {
		const { themes, currentThemeIndex } = args[0];
		const id = themes[currentThemeIndex]?.unboundAddonId;

		// Both pickers' carousels pass through here; this one's holds its swatches.
		if (!id || !target.ids.has(id) || currentThemeIndex === last) return;

		const first = last === undefined;

		last = currentThemeIndex;

		// The carousel is rendering; applying re-renders other components, which is not allowed now.
		if (!first) {
			queueMicrotask(() => target.select(id));
		}
	});
}

/**
 * @description Applies the swatch Discord's theme picker settles on as soon as it settles.
 * @param ids The ids of the picker's swatches.
 * @param select Applies the swatch with that id.
 */
function useApplyOnSelect(ids: string[], select: Select) {
	// Installed during this first render, ahead of the carousel's. The patch reads `target`, which the effect below updates.
	const [{ target, unwatch }] = useState(() => {
		const initial: Target = { ids: new Set(ids), select };

		return { target: initial, unwatch: watchCarousel(initial) };
	});

	useEffect(() => {
		target.ids = new Set(ids);
		target.select = select;
	}, [target, ids, select]);

	useEffect(() => unwatch, [unwatch]);
}

export default useApplyOnSelect;
