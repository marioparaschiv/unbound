import { native } from '@unbound-app/api';

import { msPerDurationUnit as android } from '~/moyai/android/duration-unit';
import { msPerDurationUnit as ios } from '~/moyai/ios/duration-unit';

export const msPerDurationUnit = native.definePlatform({ ios, android });
