import { native } from '@unbound-app/api';

import { playableSoundAndroid as android } from '~/native/android/playable-sound';
import { playableSoundIOS as ios } from '~/native/ios/playable-sound';

/**
 * @description Checks whether Discord can play one of its own sounds in place of another on this platform.
 */
export const playableSound = native.definePlatform({ ios, android });

export default playableSound;
