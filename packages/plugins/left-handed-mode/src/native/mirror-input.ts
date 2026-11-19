import { native } from '@unbound-app/api';

import { mirrorIOS as ios } from '~/native/ios/mirror';

/**
 * @description Mirrors the chat input until the returned function is called. iOS only.
 */
export const mirrorInput = native.definePlatform({ ios });
