import { patcher } from '@unbound-app/api';

import { patchTagProperties } from '~/patches';

export function start() {
	patchTagProperties();
}

export function stop() {
	patcher.unpatchAll();
}
