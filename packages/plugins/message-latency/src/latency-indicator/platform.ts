import { native } from '@unbound-app/api';

import { createIndicators as android } from '~/latency-indicator/android/start';
import { createIndicators as ios } from '~/latency-indicator/ios/start';

export const createIndicators = native.definePlatform({ ios, android });
