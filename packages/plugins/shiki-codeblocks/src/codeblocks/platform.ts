import { native } from '@unbound-app/api';

import { startCards as android } from '~/codeblocks/android/start';
import { startCards as ios } from '~/codeblocks/ios/start';

export const startCards = native.definePlatform({ ios, android });
