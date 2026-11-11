import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { PluginContext } from '@unbound-app/api/native';
import { metro, patcher } from '@unbound-app/api';

import type { MediaItemElement } from '~/lib/types';
import { sizeBadgesForRow } from '~/lib/badges';
import SizeBadge from '~/components/size-badge';
import { openFileSizes } from '~/native/calls';

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
 * Discord's media picker draws each row of thumbnails with. `stop` releases the size lookup's native handles.
 * @param context The plugin's context, whose Java bridge Android reads the sizes Discord leaves out with.
 */
export function patchMediaKeyboardItem(context: PluginContext): void {
	const MediaKeyboardItem = metro.findByFilePath(
		'modules/media_keyboard/native/components/MediaKeyboardItem.tsx',
	);

	if (!MediaKeyboardItem) {
		logger.warn('File sizes skipped: Discord moved MediaKeyboardItem.');

		return;
	}

	const sizes = openFileSizes(context);

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
}
