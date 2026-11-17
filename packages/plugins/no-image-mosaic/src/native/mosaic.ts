import { native } from '@unbound-app/api';

import { stackAndroid as android } from '~/native/android/mosaic';
import { stackIOS as ios } from '~/native/ios/mosaic';

/**
 * @description Stacks media mosaics one image per row.
 */
export const stackMosaics = native.definePlatform({ ios, android });
