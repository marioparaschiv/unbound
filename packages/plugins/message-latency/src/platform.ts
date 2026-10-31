import { native } from '@unbound-app/api';

import { createIndicators as android } from '~/android/start';
import { createIndicators as ios } from '~/ios/start';

/** Prepares the platform's indicator feature for the message list. */
export const createIndicators = native.definePlatform({ ios, android });
