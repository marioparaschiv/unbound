import { patcher } from '@unbound-app/api';

import {
	patchChatInputRightActions,
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
	patchVoiceMessageButton();
	patchPrivateChannelButtons();
	patchProfileContactButtons();
	patchYouScreenButtons();
	patchGuildActionRows();
}

export function stop() {
	patcher.unpatchAll();
}
