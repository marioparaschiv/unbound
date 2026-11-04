import { native } from '@unbound-app/api';

import { startMentions as android } from '~/avatars/android/start';
import { startMentions as ios } from '~/avatars/ios/start';

export const startRenderer = native.definePlatform({ ios, android });
