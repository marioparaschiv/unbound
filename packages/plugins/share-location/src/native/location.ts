import { native } from '@unbound-app/api';

import { currentLocationIOS as ios } from '~/native/ios/location';

/**
 * @description Reads the device's location once. iOS only.
 */
export const currentLocation = native.definePlatform({ ios });
