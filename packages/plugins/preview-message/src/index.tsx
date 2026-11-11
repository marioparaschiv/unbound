import { patcher } from '@unbound-app/api';

import { patchChatInput } from '~/patches/chat-input';

export function start() {
	patchChatInput();
}

export function stop() {
	patcher.unpatchAll();
}
