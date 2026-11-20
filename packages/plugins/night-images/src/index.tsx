import { patcher } from '@unbound-app/api';

import { patchRowManager } from '~/patches/row-manager';

export function start() {
	patchRowManager();
}

export function stop() {
	patcher.unpatchAll();
}
