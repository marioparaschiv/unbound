import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';

import { patchGiftOrThreadButton } from '~/patches/chat-input-action-button-gift-or-thread';
import { patchChatInputRightActions } from '~/patches/chat-input-right-actions';

let dispose = () => {};

function start() {
	dispose = applyFeatures('Hide Gift Button', [
		patchGiftOrThreadButton,
		patchChatInputRightActions,
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
