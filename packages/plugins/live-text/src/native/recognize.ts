import { native } from '@unbound-app/api';

import { recognizeOnIOS as ios } from '~/native/ios/recognize';

/**
 * @description Reads the text in an image with Vision; iOS only.
 */
export const recognizeText = native.definePlatform({ ios });
