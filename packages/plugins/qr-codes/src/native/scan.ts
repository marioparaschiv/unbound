import { native } from '@unbound-app/api';

import { scanOnAndroid as android } from '~/native/android/scan';
import { scanOnIOS as ios } from '~/native/ios/scan';

/**
 * @description Reads the first QR code in an image: Core Image on iOS, the ZXing build Discord carries on Android.
 */
export const scanQrCode = native.definePlatform({ ios, android });
