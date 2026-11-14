import { chatRowsSelfTest, trackChatRows } from '@unbound-plugins/shared/lifecycle/chat-rows';
import { patcher } from '@unbound-app/api';

import { patchChatRows } from '~/patches';
import SettingsPanel from '~/settings';

export function start() {
	patchChatRows();
	trackChatRows();
}

export function stop() {
	patcher.unpatchAll();
}

export function selfTest() {
	return chatRowsSelfTest();
}

export { SettingsPanel };
