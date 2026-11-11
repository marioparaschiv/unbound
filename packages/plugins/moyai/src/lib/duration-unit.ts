import { native } from '@unbound-app/api';

import { msPerDurationUnit as android } from '~/lib/android/duration-unit';
import { msPerDurationUnit as ios } from '~/lib/ios/duration-unit';

export const msPerDurationUnit = native.definePlatform({ ios, android });
