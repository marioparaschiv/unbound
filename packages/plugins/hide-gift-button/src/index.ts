import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchGiftOrThreadButton } from '~/patches/chat-input-action-button-gift-or-thread';
import { patchChatInputRightActions } from '~/patches/chat-input-right-actions';

export function start() {
	applyFeatures('Hide Gift Button', [patchGiftOrThreadButton, patchChatInputRightActions]);
}

export { featureSelfTest as selfTest };
