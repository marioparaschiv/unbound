import { patcher } from '@unbound-app/api';

import { patchSlowmode } from '~/patches';

export function start() {
	patchSlowmode();
}

export function stop() {
	patcher.unpatchAll();
}
