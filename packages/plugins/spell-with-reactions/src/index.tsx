import { patcher } from '@unbound-app/api';

import { patchActionSheets } from '~/patches';

export function start() {
	patchActionSheets();
}

export function stop() {
	patcher.unpatchAll();
}
