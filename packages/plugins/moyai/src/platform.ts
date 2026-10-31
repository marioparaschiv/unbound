import { native } from '@unbound-app/api';

import { durationUnit as android } from '~/android/duration-unit';
import { durationUnit as ios } from '~/ios/duration-unit';

/** How many milliseconds one unit of the sound manager's reported duration is. */
export const durationUnit = native.definePlatform({ ios, android });
