import { native } from '@unbound-app/api';

import { listenAndroid as android } from '~/native/android/controller';
import { listenIOS as ios } from '~/native/ios/controller';

/**
 * @description Listens to a game controller's D-pad and buttons.
 */
export const listenToController = native.definePlatform({ ios, android });
