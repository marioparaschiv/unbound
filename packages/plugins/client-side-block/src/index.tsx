import { patcher, storage } from '@unbound-app/api';

import { refreshChat } from '~/lib/chat';
import { patchChatRows } from '~/patches';

let stopRefreshing: (() => void) | undefined;

export function start() {
	patchChatRows();
	stopRefreshing = storage.onChange(({ store }) => store === addon.id, refreshChat);
}

export function stop() {
	stopRefreshing?.();
	stopRefreshing = undefined;
	patcher.unpatchAll();
	// Shows hidden messages in the open chat again, once `createRow` is no longer patched.
	refreshChat();
}
