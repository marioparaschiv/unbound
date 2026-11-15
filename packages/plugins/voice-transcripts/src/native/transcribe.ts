import { native } from '@unbound-app/api';

import { transcribeOnAndroid as android } from '~/native/android/transcribe';
import { transcribeOnIOS as ios } from '~/native/ios/transcribe';

/**
 * @description Transcribes audio on the device: Apple's speech recognizer on iOS, Android's on Android.
 */
export const transcribe = native.definePlatform({ ios, android });
