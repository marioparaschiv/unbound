import { native } from '@unbound-app/api';

import { patchChatInputRightActions } from '~/patches/chat-input-right-actions';
import { patchChatInputSendButton } from '~/patches/chat-input-send-button';

export const patchToggleButton = native.definePlatform({
	ios: patchChatInputRightActions,
	android: patchChatInputSendButton,
});
