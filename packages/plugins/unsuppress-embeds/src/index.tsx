import { patcher } from '@unbound-app/api';

import { forgetOpenSheet, patchActionSheets } from '~/patches';

export function start() {
	patchActionSheets();
}

export function stop() {
	patcher.unpatchAll();
	forgetOpenSheet();
}
