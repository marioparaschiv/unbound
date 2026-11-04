import {
	findElement,
	getElementName,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { patcher } from '@unbound-app/api';

import type { ExpressionSheetPatches } from '~/expression-actions/action-sheets';
import { StickerDetailActionSheet } from '~/expression-actions/modules';
import { parseSticker } from '~/expression-actions/expression';

function isGuildStickerDetail(element: ElementNode): boolean {
	return getElementName(element) === 'GuildStickerDetail';
}

/**
 * @description Adds the action bar to the sticker sheet Discord opens from a message, which does not go through `openLazy`.
 * @param sheets The patches that add the action bar to a detail element.
 */
export function patchStickerDetailActionSheet(sheets: ExpressionSheetPatches): void {
	patcher.react.after(StickerDetailActionSheet, 'default', ({ props, result }) => {
		const sticker = parseSticker(props) ?? parseSticker(result);
		const detail = findElement(result, isGuildStickerDetail);

		if (sticker && detail) sheets.patchDetailSheet(detail, sticker, 'StickerDetailActionSheet');
	});
}
