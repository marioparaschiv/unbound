import { patcher } from '@unbound-app/api';

import { patchTypingIndicator } from '~/patches';

export function start() {
	patchTypingIndicator();
}

export function stop() {
	patcher.unpatchAll();
}
