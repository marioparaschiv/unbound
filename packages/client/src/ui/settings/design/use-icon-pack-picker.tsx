import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { createPatcher } from '~/patcher/create-patcher';
import { findComponent } from '~/utils/react';
import type { Addon } from '~/addons/addon';

import { ChannelListPreview, SelectorItem, type PickerTheme } from './appearance-picker';
import IconPackPreview from './icon-pack-preview';
import IconPackSwatch from './icon-pack-swatch';

const Patcher = createPatcher('unbound::design-picker-icons');

/** The icon packs the watched picker stands for, swapped when the list changes. */
type Lookup = { byId: Map<string, Addon> };

type ParentProps = { children: ReactNode[] };

type BackgroundProps = { item?: PickerTheme };

type ListProps = { data?: unknown; renderItem?: unknown };

const byIdOf = (addons: Addon[]) => new Map(addons.map((addon) => [addon.id, addon]));

const isBackground = (node: ReactNode) =>
	Boolean((node as ReactElement<BackgroundProps> | null)?.props?.item);

function isList(node: ReactNode) {
	const props = (node as ReactElement<ListProps> | null)?.props;

	return Boolean(props?.data && props.renderItem);
}

/** Finds the element whose children hold one that `match` picks, so that child can be swapped. */
function parentOf(tree: ReactElement, match: (node: ReactNode) => boolean) {
	return findComponent<ParentProps>(
		tree,
		(element) => Array.isArray(element.props.children) && element.props.children.some(match),
	);
}

/** Swaps the background inside an icon pack's swatch for {@link IconPackSwatch}, keeping Discord's selection ring. */
function watchSwatches(lookup: Lookup) {
	return Patcher.after(SelectorItem, 'default', ({ args: [props], result }) => {
		const pack = lookup.byId.get(props.themePreset.unboundAddonId);
		const ring = pack && parentOf(result, isBackground);

		if (!pack || !ring) {
			return result;
		}

		// The item may hand back a cached tree, so the children are replaced rather than edited in place.
		ring.props.children = ring.props.children.map((child) =>
			isBackground(child) ? <IconPackSwatch key='unbound-swatch' pack={pack} /> : child,
		);

		return result;
	});
}

/** Swaps the preview's mock "Messages" list for {@link IconPackPreview}, keeping its backdrop. */
function watchPreview(lookup: Lookup) {
	return Patcher.after(ChannelListPreview, 'default', ({ args: [props], result }) => {
		const pack = lookup.byId.get(props.themes[props.themeIndex]?.unboundAddonId ?? '');
		const parent = pack && parentOf(result, isList);

		if (!pack || !parent) {
			return result;
		}

		parent.props.children = parent.props.children.map((child) =>
			isList(child) ? <IconPackPreview key='unbound-icons' pack={pack} /> : child,
		);

		return result;
	});
}

/**
 * @description Shows each icon pack in Discord's theme picker by its icons: one on its swatch, and a grid of common
 * ones as the preview. Installed during the first render, ahead of the picker's.
 * @param packs The icon packs the swatches stand for; none for a picker of themes.
 */
function useIconPackPicker(packs: Addon[]) {
	const [{ lookup, unwatch }] = useState(() => {
		const initial: Lookup = { byId: byIdOf(packs) };

		const unwatchSwatches = watchSwatches(initial);
		const unwatchPreview = watchPreview(initial);

		return {
			lookup: initial,
			unwatch: () => {
				unwatchSwatches();
				unwatchPreview();
			},
		};
	});

	useEffect(() => {
		lookup.byId = byIdOf(packs);
	}, [lookup, packs]);

	useEffect(() => unwatch, [unwatch]);
}

export default useIconPackPicker;
