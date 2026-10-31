import { native } from '@unbound-app/api';

import { startCards as android } from '~/android/start';
import { startCards as ios } from '~/ios/start';

export const startCards = native.definePlatform({ ios, android });
