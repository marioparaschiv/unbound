import { definePlatform } from '@unbound-app/api/native';

import { patchChatInputSendButton as android } from '~/silent/android/send-button';
import { patchChatInputRightActions as ios } from '~/silent/ios/right-actions';

export const startToggleButton = definePlatform({ ios, android });
