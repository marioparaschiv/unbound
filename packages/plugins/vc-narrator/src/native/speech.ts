import { native } from '@unbound-app/api';

import { speechAndroid as android } from '~/native/android/speech';
import { speechIOS as ios } from '~/native/ios/speech';

/**
 * @description Speaks lines aloud through each platform's text-to-speech engine.
 */
export const createSpeech = native.definePlatform({ ios, android });
