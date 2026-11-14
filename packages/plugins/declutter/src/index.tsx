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
} from '~/patches/buttons';
import { patchMessageContent, patchPremiumSettings, patchProfileTabs } from '~/patches/upsells';
import { patchBlankTargets } from '~/patches/blank';
import { stopWaiting } from '~/lib/when-loaded';

export function start() {
	patchGiftOrThreadButton();
	patchChatInputRightActions();
	patchEmptySendButton();
	patchVoiceMessageButton();
	patchPrivateChannelButtons();
	patchProfileContactButtons();
	patchYouScreenButtons();
	patchGuildActionRows();
	patchBlankTargets();
	patchMessageContent();
	patchPremiumSettings();
	patchProfileTabs();
}

export function stop() {
	stopWaiting();
	patcher.unpatchAll();
}
