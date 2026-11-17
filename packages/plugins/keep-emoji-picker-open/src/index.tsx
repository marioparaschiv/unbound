import { patcher } from '@unbound-app/api';

import { patchPicker } from '~/patches';

export function start() {
	patchPicker();
}

export function stop() {
	patcher.unpatchAll();
}
