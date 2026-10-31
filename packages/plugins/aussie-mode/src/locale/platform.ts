import { native } from '@unbound-app/api';

import { deviceLocale as android } from '~/locale/android/device-locale';
import { deviceLocale as ios } from '~/locale/ios/device-locale';

export const deviceLocale = native.definePlatform({ ios, android });
