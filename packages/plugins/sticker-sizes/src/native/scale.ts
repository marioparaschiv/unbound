import { native } from '@unbound-app/api';

import { scaleAndroid as android } from '~/native/android/scale';
import { scaleIOS as ios } from '~/native/ios/scale';

/**
 * @description Shows stickers at a chosen scale, through each platform's native sticker view.
 */
export const stickerScale = native.definePlatform({ ios, android });
