import { native } from '@unbound-app/api';

import { startMentions as android } from '~/android/start';
import { startMentions as ios } from '~/ios/start';

/** Starts drawing mention images on this platform's message views. */
export const startMentions = native.definePlatform({ ios, android });
