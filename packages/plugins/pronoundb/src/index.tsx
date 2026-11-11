import { patcher } from '@unbound-app/api';

import { patchMessageRows, stopLookup } from '~/patches';

export function start() {
	patchMessageRows();
}

export function stop() {
	patcher.unpatchAll();
	stopLookup();
}
