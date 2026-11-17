import { native } from '@unbound-app/api';

import { packsAndroid as android } from '~/native/android/packs';
import { packsIOS as ios } from '~/native/ios/packs';

/**
 * @description Draws unicode emoji from a pack, through each platform's native emoji renderer.
 */
export const emojiPacks = native.definePlatform({ ios, android });
