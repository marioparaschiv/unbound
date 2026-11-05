import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { PluginContext } from '@unbound-app/api/native';
import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import { patcher } from '@unbound-app/api';

import type { MediaItemElement } from '~/types';
import { sizeBadgesForRow } from '~/file-sizes/badges';
import { MediaKeyboardItem } from '~/file-sizes/modules';
import SizeBadge from '~/file-sizes/components/size-badge';
import { createFileSizes } from '~/file-sizes/platform';
import { PLUGIN_NAME } from '~/constants';

type MediaRow = ReactElement<{
	children?: (MediaItemElement | null)[];
	style?: { paddingHorizontal?: number };
}>;

function isMediaRow(node: ReactNode): node is MediaRow {
	return isValidElement(node);
}

/**
 * @description Overlays each media picker thumbnail with its file size.
 * Patches the render of `MediaKeyboardItem` (`modules/media_keyboard/native/components/MediaKeyboardItem.tsx`), which
 * Discord's media picker draws each row of thumbnails with. The Addon scope removes the patch when the plugin stops.
 * @param context The plugin's context, whose Java bridge Android reads the sizes Discord leaves out with.
 * @returns A function that releases the native handles the size lookup holds, which the scope cannot see.
 */
export function startFileSizes(context: PluginContext): () => void {
	if (!ensureModules(PLUGIN_NAME, { MediaKeyboardItem })) return () => {};

	const sizes = createFileSizes(context);

	patcher.react.after(MediaKeyboardItem, 'default', ({ result }) => {
		if (!isMediaRow(result)) return;

		const children = result.props.children;

		if (!Array.isArray(children) || !children.length) return;

		const badges = sizeBadgesForRow(
			children,
			result.props.style?.paddingHorizontal ?? 12,
			MediaKeyboardItem.SEPARATOR_SIZE ?? 4,
			sizes.lookup,
		);

		if (!badges.length) return;

		return cloneElement(result, {}, [
			...children,
			...badges.map(({ key, label, left }) => (
				<SizeBadge key={key} label={label} left={left} />
			)),
		]);
	});

	recordApplied(1);

	return sizes.release;
}
