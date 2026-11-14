import { native } from '@unbound-app/api';

import { speedAndroid as android } from '~/native/android/speed';
import { speedIOS as ios } from '~/native/ios/speed';

/**
 * @description Plays voice messages at a chosen speed, through each platform's native player.
 */
export const voiceMessageSpeed = native.definePlatform({ ios, android });
