import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	createExpressionSheetPatches,
	patchActionSheets,
} from '~/expression-actions/action-sheets';
import { patchStickerDetailActionSheet } from '~/expression-actions/sticker-detail-sheet';
import { ActionSheets } from '~/expression-actions/modules';
import { PLUGIN_NAME } from '~/constants';

let sheets = createExpressionSheetPatches();

/**
 * @description Adds the Copy URL, Copy markup, Favorite and Clone buttons to emoji and sticker sheets.
 * Patches `openLazy` on Discord's action sheets, and the render of `StickerDetailActionSheet`. Reads the
 * clipboard, the sticker actions, `EmojiActions`, `Auth`, and the `Guild` and `User` stores for the buttons' work.
 * A sheet that fails to patch is logged and recorded, and the other still starts. The Addon scope removes the patches.
 */
export function startExpressionActions(): void {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return;

	// Fresh per start, since `stop` marks the previous one as stopped for good.
	sheets = createExpressionSheetPatches();

	const failed: string[] = [];
	let applied = 0;

	// One sheet failing to patch must not leave the other without its buttons.
	for (const [name, patch] of [
		['emoji and sticker sheets', patchActionSheets],
		['sticker detail sheet', patchStickerDetailActionSheet],
	] as const) {
		try {
			patch(sheets);
			applied++;
		} catch (error) {
			failed.push(name);
			console.error(`[${PLUGIN_NAME}] Failed to patch the ${name}:`, error);
		}
	}

	// After the successes, since recording an applied feature clears a recorded failure.
	recordApplied(applied);

	if (failed.length) recordFailure(`${failed.join(', ')} failed to start`);
}

/**
 * @description Ignores the sheets that load after the plugin stops, which the Addon scope cannot patch away.
 */
export function stopExpressionActions(): void {
	sheets.stop();
}
