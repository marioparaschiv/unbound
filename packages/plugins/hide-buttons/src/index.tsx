import { patcher } from '@unbound-app/api';

import {
	patchChatInputRightActions,
	patchEmptySendButton,
	patchGiftOrThreadButton,
	patchGuildActionRows,
	patchPrivateChannelButtons,
	patchProfileContactButtons,
	patchVoiceMessageButton,
	patchYouScreenButtons,
} from '~/patches';

export function start() {
	patchGiftOrThreadButton();
	patchChatInputRightActions();
	patchEmptySendButton();
	patchVoiceMessageButton();
	patchPrivateChannelButtons();
	patchProfileContactButtons();
	patchYouScreenButtons();
	patchGuildActionRows();
}

export function stop() {
	patcher.unpatchAll();
}
