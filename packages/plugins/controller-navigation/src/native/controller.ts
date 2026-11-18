import { native } from '@unbound-app/api';

import { listenAndroid as android } from '~/native/android/controller';

/**
 * @description Listens to a game controller's D-pad and buttons; Android only, so iOS installs never offer the plugin.
 */
export const listenToController = native.definePlatform({ android });
