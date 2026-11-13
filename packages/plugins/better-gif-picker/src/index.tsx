import { patcher } from '@unbound-app/api';

import { patchGifPicker } from '~/patches';

export function start() {
	patchGifPicker();
}

export function stop() {
	patcher.unpatchAll();
}
