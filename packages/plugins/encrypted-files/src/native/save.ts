import { native } from '@unbound-app/api';

import { saveOnAndroid as android } from '~/native/android/save';
import { saveOnIOS as ios } from '~/native/ios/save';

/**
 * @description Saves a decrypted file: to Downloads on Android, through the share sheet on iOS.
 */
export const saveDecrypted = native.definePlatform({ ios, android });
