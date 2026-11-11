import { patcher } from '@unbound-app/api';

import { patchChatInputRightActions, patchGiftOrThreadButton } from '~/patches';

export function start() {
	patchGiftOrThreadButton();
	patchChatInputRightActions();
}

export function stop() {
	patcher.unpatchAll();
}
