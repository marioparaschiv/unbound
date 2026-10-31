import { native } from '@unbound-app/api';

import { startEmbeds as android } from '~/android/start';
import { startEmbeds as ios } from '~/ios/start';

/** Starts the host platform's embeds. */
export const startEmbeds = native.definePlatform({ ios, android });
