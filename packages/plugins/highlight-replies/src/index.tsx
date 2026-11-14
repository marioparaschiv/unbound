import { patcher } from '@unbound-app/api';

import { patchReplyRows } from '~/patches';

export function start() {
	patchReplyRows();
}

export function stop() {
	patcher.unpatchAll();
}
