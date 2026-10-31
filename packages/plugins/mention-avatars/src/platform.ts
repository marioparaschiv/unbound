import { native } from '@unbound-app/api';

import { startMentions as android } from '~/android/start';
import { startMentions as ios } from '~/ios/start';

export const startMentions = native.definePlatform({ ios, android });
