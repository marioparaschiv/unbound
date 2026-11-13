import { patcher } from '@unbound-app/api';

import { patchChatInput, patchTyping } from '~/patches';

export function start() {
	patchTyping();
	patchChatInput();
}

export function stop() {
	patcher.unpatchAll();
}
