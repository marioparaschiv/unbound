import { chatRowsSelfTest, trackChatRows } from '@unbound-plugins/shared/lifecycle/chat-rows';
import { patcher } from '@unbound-app/api';

import { dropHiddenMessages, patchChatRows } from '~/patches';
import SettingsPanel from '~/settings';

let letMessagesThrough: (() => void) | undefined;

export function start() {
	patchChatRows();
	trackChatRows();
	letMessagesThrough = dropHiddenMessages();
}

export function stop() {
	letMessagesThrough?.();
	letMessagesThrough = undefined;
	patcher.unpatchAll();
}

export function selfTest() {
	return chatRowsSelfTest();
}

export { SettingsPanel };
