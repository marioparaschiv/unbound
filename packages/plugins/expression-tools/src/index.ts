import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { createExpressionSheetPatches, patchActionSheets } from '~/patches/action-sheets';
import { patchStickerDetailActionSheet } from '~/patches/sticker-detail-action-sheet';
import { PLUGIN_NAME } from '~/constants';
import { ActionSheets } from '~/modules';

const sheets = createExpressionSheetPatches();

function start() {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return;

	patchActionSheets(sheets);
	patchStickerDetailActionSheet(sheets);
	recordApplied(2);
}

function stop() {
	sheets.stop();
}

export default { start, stop, selfTest: featureSelfTest };
