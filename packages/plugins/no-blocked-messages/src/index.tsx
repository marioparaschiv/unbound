import { patcher } from '@unbound-app/api';

import { refreshChat } from '~/lib/chat';
import { patchChatRows } from '~/patches';

export function start() {
	patchChatRows();
}

export function stop() {
	patcher.unpatchAll();
	// Shows blocked messages in the open chat again, once `createRow` is no longer patched.
	refreshChat();
}
