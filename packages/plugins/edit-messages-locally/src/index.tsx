import { patcher } from '@unbound-app/api';

import { patchActionSheets, patchChangeType, patchMessageRows } from '~/patches';

export function start() {
	patchMessageRows();
	patchChangeType();
	patchActionSheets();
}

export function stop() {
	patcher.unpatchAll();
}
