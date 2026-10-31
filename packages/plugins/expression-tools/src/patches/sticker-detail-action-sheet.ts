import {
	findElement,
	getElementName,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { patcher } from '@unbound-app/api';

import type { ExpressionSheetPatches } from '~/patches/action-sheets';
import { StickerDetailActionSheetSource } from '~/modules';
import { parseSticker } from '~/expression';
import { PLUGIN_NAME } from '~/constants';

type StickerDetailActionSheetModule = {
	default?: { type: (...args: unknown[]) => unknown };
};

function isGuildStickerDetail(element: ElementNode): boolean {
	return getElementName(element) === 'GuildStickerDetail';
}

function patchLoadedSheet(
	sheets: ExpressionSheetPatches,
	StickerDetailActionSheet: StickerDetailActionSheetModule,
) {
	const sheet = StickerDetailActionSheet.default;

	if (typeof sheet?.type !== 'function') {
		console.error(`[${PLUGIN_NAME}] Skipped message stickers, their sheet is not a memo.`);

		return;
	}

	return patcher.after(sheet, 'type', ({ args: [props], result }) => {
		const sticker = parseSticker(props) ?? parseSticker(result);
		const detail = findElement(result, isGuildStickerDetail);

		if (sticker && detail) sheets.patchDetailSheet(detail, sticker, 'StickerDetailActionSheet');
	});
}

/**
 * @description Adds the action bar to the sticker sheet Discord opens from a message, which does not go through `openLazy`, once the sheet loads.
 * @param sheets The patches that add the action bar to a detail element.
 */
export function patchStickerDetailActionSheet(sheets: ExpressionSheetPatches): void {
	whenLoaded<StickerDetailActionSheetModule>(StickerDetailActionSheetSource, (module) =>
		patchLoadedSheet(sheets, module),
	);
}

export default patchStickerDetailActionSheet;
