import { patcher } from '@unbound-app/api';

import { patchEditStatus } from '~/patches';

export function start() {
	patchEditStatus();
}

export function stop() {
	patcher.unpatchAll();
}
