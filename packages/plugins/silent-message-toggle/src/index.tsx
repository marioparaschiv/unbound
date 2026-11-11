import { patcher } from '@unbound-app/api';

import { patchMessageActions } from '~/patches/message-actions';
import { listenToChannelSwitch } from '~/flux/listeners';
import { patchChatInput } from '~/patches/chat-input';

export function start() {
	patchMessageActions();
	listenToChannelSwitch();
	patchChatInput();
}

export function stop() {
	patcher.unpatchAll();
}
