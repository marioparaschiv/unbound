import { native } from '@unbound-app/api';

import { backgroundPlaybackIOS as ios } from '~/native/ios/background';

/**
 * @description Keeps audio attachments playing once Discord leaves the screen, through each platform's audio session.
 */
export const backgroundPlayback = native.definePlatform({ ios });
