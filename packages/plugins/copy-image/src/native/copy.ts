import { native } from '@unbound-app/api';

import { copyOnAndroid as android } from '~/native/android/copy';
import { copyOnIOS as ios } from '~/native/ios/copy';

/**
 * @description Puts a PNG on the system clipboard as an image.
 */
export const copyPng = native.definePlatform({ ios, android });
