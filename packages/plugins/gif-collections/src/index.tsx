import { patcher } from '@unbound-app/api';

import { setOpenCollection } from '~/lib/open-collection';
import { patchItemSheet } from '~/patches/item-sheet';
import { patchGifPicker } from '~/patches/picker';

export function start() {
	patchItemSheet();
	patchGifPicker();
}

export function stop() {
	setOpenCollection(undefined);
	patcher.unpatchAll();
}
