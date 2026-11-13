import { patcher } from '@unbound-app/api';

import { patchRowManager } from '~/patches';

export function start() {
	patchRowManager();
}

export function stop() {
	patcher.unpatchAll();
}
