import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	createExpressionSheetPatches,
	patchActionSheets,
} from '~/expression-actions/action-sheets';
import { patchStickerDetailActionSheet } from '~/expression-actions/sticker-detail-sheet';
import { ActionSheets } from '~/expression-actions/modules';
import { PLUGIN_NAME } from '~/constants';

const sheets = createExpressionSheetPatches();

/**
 * @description Adds the Copy URL, Copy markup, Favorite and Clone buttons to emoji and sticker sheets.
 * Patches `openLazy` on Discord's action sheets, and the render of `StickerDetailActionSheet`. Reads the
 * clipboard, the sticker actions, `EmojiActions`, `Auth`, and the `Guild` and `User` stores for the buttons' work.
 * The Addon scope removes the patches.
 */
export function startExpressionActions(): void {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return;

	patchActionSheets(sheets);
	patchStickerDetailActionSheet(sheets);
	recordApplied(2);
}

/**
 * @description Ignores the sheets that load after the plugin stops, which the Addon scope cannot patch away.
 */
export function stopExpressionActions(): void {
	sheets.stop();
}
