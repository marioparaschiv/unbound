import { patcher } from '@unbound-app/api';

import { patchRolePills } from '~/patches';

export function start() {
	patchRolePills();
}

export function stop() {
	patcher.unpatchAll();
}
