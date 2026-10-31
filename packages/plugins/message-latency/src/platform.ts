import { native } from '@unbound-app/api';

import { createIndicators as android } from '~/android/start';
import { createIndicators as ios } from '~/ios/start';

export const createIndicators = native.definePlatform({ ios, android });
