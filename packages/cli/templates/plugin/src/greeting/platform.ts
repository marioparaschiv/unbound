import { definePlatform } from '@unbound-app/api/native';

import { platformName as android } from '~/greeting/android/platform-name';
import { platformName as ios } from '~/greeting/ios/platform-name';

export const platformName = definePlatform({ ios, android });
