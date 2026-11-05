import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { createPatcher } from '~/patcher/create-patcher';
import { findComponent } from '~/utils/react';

import { Carousel } from './appearance-picker';

const Patcher = createPatcher('unbound::design-picker-nitro-badge');

/** The swatch ids the watched carousel stands for, swapped when the list changes. */
type Target = { ids: Set<string> };

type RowProps = { children: ReactNode[] };

type TitlePartProps = { variant?: string; source?: unknown; size?: unknown };

const propsOf = (node: ReactNode) => (node as ReactElement<TitlePartProps> | null)?.props;

const isName = (node: ReactNode) => propsOf(node)?.variant === 'heading-sm/semibold';

function isIcon(node: ReactNode) {
	const props = propsOf(node);

	return props?.source !== undefined && props.size !== undefined;
}

/**
 * @description Drops the Nitro icon the carousel puts before a custom gradient swatch's name. Unbound's swatches are
 * gradients only so the picker tints them; they are not Nitro themes.
 */
function watchCarousel(target: Target) {
	return Patcher.after(Carousel, 'default', ({ args: [props], result }) => {
		if (!target.ids.has(props.themes[props.currentThemeIndex]?.unboundAddonId ?? '')) {
			return result;
		}

		const row = findComponent<RowProps>(
			result,
			(element) =>
				Array.isArray(element.props.children) &&
				element.props.children.some(isName) &&
				element.props.children.some(isIcon),
		);

		if (!row) {
			return result;
		}

		// The carousel caches its title, so the children are replaced rather than edited in place.
		row.props.children = row.props.children.filter((child) => !isIcon(child));

		return result;
	});
}

/**
 * @description Hides the Nitro icon before the names of this picker's swatches. Installed during the first render,
 * ahead of the carousel's.
 * @param ids The ids of the picker's swatches.
 */
function useHideNitroBadge(ids: string[]) {
	const [{ target, unwatch }] = useState(() => {
		const initial: Target = { ids: new Set(ids) };

		return { target: initial, unwatch: watchCarousel(initial) };
	});

	useEffect(() => {
		target.ids = new Set(ids);
	}, [target, ids]);

	useEffect(() => unwatch, [unwatch]);
}

export default useHideNitroBadge;
