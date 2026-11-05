import type { StyleProp, TextStyle } from 'react-native';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { createPatcher } from '~/patcher/create-patcher';
import { findComponent } from '~/utils/react';
import type { Addon } from '~/addons/addon';

import CarouselAuthors from './carousel-authors';
import { Carousel } from './appearance-picker';

const Patcher = createPatcher('unbound::design-picker-authors');

/** The addons the watched carousel stands for, swapped when the list changes. */
type Lookup = { byId: Map<string, Addon> };

type ParentProps = { children: ReactNode[] };

type CaptionProps = { variant?: string; children?: unknown; style?: StyleProp<TextStyle> };

const byIdOf = (addons: Addon[]) => new Map(addons.map((addon) => [addon.id, addon]));

/** The carousel's caption under the swatch name, such as "You can always change this later!". */
function isCaption(node: ReactNode) {
	const props = (node as ReactElement<CaptionProps> | null)?.props;

	return props?.variant === 'text-sm/medium' && typeof props.children === 'string';
}

/**
 * @description Swaps the carousel's caption for the authors of the addon its title names. Swatches that are no addon,
 * such as "Default", keep Discord's caption.
 */
function watchCarousel(lookup: Lookup) {
	return Patcher.after(Carousel, 'default', ({ args: [props], result }) => {
		const addon = lookup.byId.get(props.themes[props.currentThemeIndex]?.unboundAddonId ?? '');

		if (!addon?.manifest.authors?.length) {
			return result;
		}

		const parent = findComponent<ParentProps>(
			result,
			(element) =>
				Array.isArray(element.props.children) && element.props.children.some(isCaption),
		);

		if (!parent) {
			return result;
		}

		// The carousel caches its title, so the children are replaced rather than edited in place.
		// The names take the caption's animated style, so they recolour with the preview's base as Discord's text does.
		parent.props.children = parent.props.children.map((child) =>
			isCaption(child) ? (
				<CarouselAuthors
					key='unbound-authors'
					authors={addon.manifest.authors}
					nameStyle={(child as ReactElement<CaptionProps>).props.style}
				/>
			) : (
				child
			),
		);

		return result;
	});
}

/**
 * @description Shows the previewed addon's authors under its name in Discord's theme picker, pressable like an addon
 * card's. Installed during the first render, ahead of the carousel's.
 * @param addons The addons the swatches stand for.
 */
function useCarouselAuthors(addons: Addon[]) {
	const [{ lookup, unwatch }] = useState(() => {
		const initial: Lookup = { byId: byIdOf(addons) };

		return { lookup: initial, unwatch: watchCarousel(initial) };
	});

	useEffect(() => {
		lookup.byId = byIdOf(addons);
	}, [lookup, addons]);

	useEffect(() => unwatch, [unwatch]);
}

export default useCarouselAuthors;
