import { native } from '@unbound-app/api';

import { privacyAndroid as android } from '~/native/android/privacy';
import { privacyIOS as ios } from '~/native/ios/privacy';

/**
 * @description Hides Discord's content in the app switcher until stopped.
 */
export const startPrivacyScreen = native.definePlatform({ ios, android });
