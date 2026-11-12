import { patcher } from '@unbound-app/api';

import { isTranslating, patchMessageActions } from '~/patches/message-actions';
import { listenToChannelSwitch } from '~/flux/listeners';
import { translate } from '~/lib/translator';
import { patchChatInput } from '~/patches/chat-input';

export function start() {
	patchMessageActions();
	listenToChannelSwitch();
	patchChatInput();
}

export function stop() {
	patcher.unpatchAll();
}

export function selfTest() {
	const translated = translate('thank you');
	const ok = isTranslating() && translated !== 'thank you';

	return {
		ok,
		detail: `${isTranslating() ? 'patched' : 'not patched'} sending, "thank you" became "${translated}"`,
	};
}
