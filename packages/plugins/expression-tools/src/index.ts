import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { createExpressionSheetPatches, patchActionSheets } from '~/patches/action-sheets';
import { patchStickerDetailActionSheet } from '~/patches/sticker-detail-action-sheet';
import { PLUGIN_NAME } from '~/constants';
import { ActionSheets } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return;

	const sheets = createExpressionSheetPatches();

	dispose = applyFeatures(PLUGIN_NAME, [
		() => sheets.dispose,
		() => patchActionSheets(sheets),
		() => patchStickerDetailActionSheet(sheets),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
