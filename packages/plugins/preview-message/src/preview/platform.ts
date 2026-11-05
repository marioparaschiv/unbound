import { native } from '@unbound-app/api';

import { patchChatInputRightActions } from '~/preview/ios/right-actions';
import { patchChatInputSendButton } from '~/preview/android/send-button';

export const patchPreviewButton = native.definePlatform({
	ios: patchChatInputRightActions,
	android: patchChatInputSendButton,
});
