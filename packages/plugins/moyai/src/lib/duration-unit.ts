import { native } from '@unbound-app/api';

import { msPerDurationUnit as android } from '~/lib/duration-unit-android';
import { msPerDurationUnit as ios } from '~/lib/duration-unit-ios';

export const msPerDurationUnit = native.definePlatform({ ios, android });
