import { native } from '@unbound-app/api';

import { msPerDurationUnit as android } from '~/android/duration-unit';
import { msPerDurationUnit as ios } from '~/ios/duration-unit';

export const msPerDurationUnit = native.definePlatform({ ios, android });
