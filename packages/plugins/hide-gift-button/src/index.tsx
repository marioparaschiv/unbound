import { patcher } from '@unbound-app/api';

import {
	patchChatInputRightActions,
	patchGiftOrThreadButton,
	patchPrivateChannelButtons,
	patchProfileContactButtons,
	patchVoiceMessageButton,
} from '~/patches';

export function start() {
	patchGiftOrThreadButton();
	patchChatInputRightActions();
	patchVoiceMessageButton();
	patchPrivateChannelButtons();
	patchProfileContactButtons();
}

export function stop() {
	patcher.unpatchAll();
}
