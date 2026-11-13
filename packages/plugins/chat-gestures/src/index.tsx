import { patcher } from '@unbound-app/api';

import { patchChatGestures } from '~/patches';

export function start() {
	patchChatGestures();
}

export function stop() {
	patcher.unpatchAll();
}
