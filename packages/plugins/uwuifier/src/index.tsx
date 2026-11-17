import { patcher } from '@unbound-app/api';

import { patchMessageActions } from '~/patches/message-actions';
import { listenToChannelSwitch } from '~/flux/listeners';
import { patchChatInput } from '~/patches/chat-input';
import { registerUwuCommand } from '~/commands';

export function start() {
	patchMessageActions();
	listenToChannelSwitch();
	patchChatInput();
	registerUwuCommand();
}

export function stop() {
	patcher.unpatchAll();
}
