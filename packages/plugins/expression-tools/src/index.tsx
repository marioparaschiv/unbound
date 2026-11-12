import { patcher } from '@unbound-app/api';

import { patchStickerDetailActionSheet } from '~/patches/sticker-detail-sheet';
import { patchActionSheets } from '~/patches/action-sheets';
import { ignoreLateSheets } from '~/patches/expression-sheets';

export function start() {
	patchActionSheets();
	patchStickerDetailActionSheet();
}

export function stop() {
	patcher.unpatchAll();
	ignoreLateSheets();
}
