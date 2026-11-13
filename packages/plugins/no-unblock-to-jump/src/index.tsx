import { patcher } from '@unbound-app/api';

import { patchJumpCheck } from '~/patches';

export function start() {
	patchJumpCheck();
}

export function stop() {
	patcher.unpatchAll();
}
