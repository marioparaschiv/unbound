import { native } from '@unbound-app/api';

import { saveOnAndroid as android } from '~/native/android/save';
import { saveOnIOS as ios } from '~/native/ios/save';

/**
 * @description Saves a voice message's audio file: to Downloads on Android, through the share sheet on iOS.
 */
export const saveVoiceFile = native.definePlatform({ ios, android });
