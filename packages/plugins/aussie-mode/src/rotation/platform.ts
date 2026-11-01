import { native } from '@unbound-app/api';

import { rotateScreen as android } from '~/rotation/android/rotate';
import { rotateScreen as ios } from '~/rotation/ios/rotate';

export const rotateScreen = native.definePlatform({ ios, android });
