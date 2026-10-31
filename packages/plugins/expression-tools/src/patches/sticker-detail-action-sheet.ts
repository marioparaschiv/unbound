import {
	findElement,
	getElementName,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { patcher } from '@unbound-app/api';

import type { ExpressionSheetPatches } from '~/patches/action-sheets';
import { StickerDetailActionSheet } from '~/modules';
import { parseSticker } from '~/expression';
import { PLUGIN_NAME } from '~/constants';

function isGuildStickerDetail(element: ElementNode): boolean {
	return getElementName(element) === 'GuildStickerDetail';
}

/**
 * @description Adds the action bar to the sticker sheet Discord opens from a message, which does not go through `openLazy`.
 * @param sheets The patches that add the action bar to a detail element.
 */
export function patchStickerDetailActionSheet(sheets: ExpressionSheetPatches): void {
	if (typeof StickerDetailActionSheet.default?.type !== 'function') {
		console.error(`[${PLUGIN_NAME}] Skipped message stickers, their sheet is not a memo.`);

		return;
	}

	patcher.after(StickerDetailActionSheet.default, 'type', ({ args: [props], result }) => {
		const sticker = parseSticker(props) ?? parseSticker(result);
		const detail = findElement(result, isGuildStickerDetail);

		if (sticker && detail) sheets.patchDetailSheet(detail, sticker, 'StickerDetailActionSheet');
	});
}

export default patchStickerDetailActionSheet;
