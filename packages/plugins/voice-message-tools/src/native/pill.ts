import { native } from '@unbound-app/api';

import { pillAndroid as android } from '~/native/android/pill';
import { pillIOS as ios } from '~/native/ios/pill';

/**
 * @description Puts speed and download buttons inside voice message pills, through each platform's native views.
 */
export const voicePillControls = native.definePlatform({ ios, android });
