import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { cloneElement, type ReactElement } from 'react';

import { sizeBadgesForRow, type FileSizeLookup, type MediaItemElement } from '~/badges';
import SizeBadge from '~/components/size-badge';
import { Patcher } from '~/modules';

type MediaRow = ReactElement<{
	children?: (MediaItemElement | null)[];
	style?: { paddingHorizontal?: number };
}>;

type MediaKeyboardItemModule = {
	default?: { type: (...args: never[]) => MediaRow };
	SEPARATOR_SIZE?: number;
};

function patchRow(module: MediaKeyboardItemModule, lookup?: FileSizeLookup): () => void {
	if (typeof module.default?.type !== 'function') {
		console.error('[File Size On Picker] Skipped, MediaKeyboardItem has no row component.');

		return () => {};
	}

	return Patcher.after(module.default, 'type', ({ result }) => {
		const children = result?.props?.children;

		if (!Array.isArray(children) || !children.length) return;

		const badges = sizeBadgesForRow(
			children,
			result.props.style?.paddingHorizontal ?? 12,
			module.SEPARATOR_SIZE ?? 4,
			lookup,
		);

		if (!badges.length) return;

		return cloneElement(result, {}, [
			...children,
			...badges.map(({ key, label, left }) => (
				<SizeBadge key={key} label={label} left={left} />
			)),
		]);
	});
}

/**
 * @description Overlays each media picker thumbnail with its file size, once the picker's row module loads.
 * @param lookup Finds the size of a thumbnail Discord reports without one.
 * @returns A function that stops waiting for the module, or removes the patch.
 */
export function patchMediaKeyboardItem(lookup?: FileSizeLookup): () => void {
	return whenLoaded(
		'modules/media_keyboard/native/components/MediaKeyboardItem.tsx',
		(module: MediaKeyboardItemModule) => patchRow(module, lookup),
	);
}
