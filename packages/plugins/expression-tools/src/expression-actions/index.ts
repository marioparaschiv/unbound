import type { Feature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	createExpressionSheetPatches,
	patchActionSheets,
} from '~/expression-actions/action-sheets';
import { patchStickerDetailActionSheet } from '~/expression-actions/sticker-detail-sheet';
import { ActionSheets } from '~/expression-actions/modules';

/**
 * @description Adds the Copy URL, Copy markup, Favorite and Clone buttons to emoji and sticker sheets.
 * Patches `openLazy` on Discord's action sheets, and the render of `StickerDetailActionSheet`. Reads the
 * clipboard, the sticker actions, `EmojiActions`, `Auth`, and the `Guild` and `User` stores for the buttons' work.
 * A sheet that fails to patch is logged and recorded, and the other still starts. The Addon scope removes the patches,
 * and the first feature's end ignores the sheets that load after the plugin stops, which the scope cannot patch away.
 * @returns The features, or nothing when `ActionSheets` is missing.
 */
export function expressionFeatures(): Feature[] | undefined {
	if (!ensureModules({ ActionSheets })) return;

	// Fresh per start, since stopping marks the previous one as stopped for good.
	const sheets = createExpressionSheetPatches();

	// One sheet failing to patch must not leave the other without its buttons.
	return [
		() => () => sheets.stop(),
		() => patchActionSheets(sheets),
		() => patchStickerDetailActionSheet(sheets),
	];
}
