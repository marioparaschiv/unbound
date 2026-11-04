import { native } from '@unbound-app/api';

import { startEmbeds as android } from '~/embeds/android/start';
import { startEmbeds as ios } from '~/embeds/ios/start';

export const startEmbeds = native.definePlatform({ ios, android });
