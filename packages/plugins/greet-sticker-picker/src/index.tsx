import { patcher } from '@unbound-app/api';

import { patchWelcomeButton } from '~/patches';

export function start() {
	patchWelcomeButton();
}

export function stop() {
	patcher.unpatchAll();
}
