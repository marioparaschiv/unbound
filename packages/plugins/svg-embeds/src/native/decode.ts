import { native } from '@unbound-app/api';

import { decodeImageAndroid as android } from '~/native/android/decode';
import { decodeImageIOS as ios } from '~/native/ios/decode';

/**
 * @description Decodes an image file in a format Discord shows only as a file, and writes it as a PNG.
 */
export const decodeImage = native.definePlatform({ ios, android });
