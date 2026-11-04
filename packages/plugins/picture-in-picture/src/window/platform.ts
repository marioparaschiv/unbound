import { native } from '@unbound-app/api';

import { createWindow as android } from '~/window/android/window';
import { createWindow as ios } from '~/window/ios/window';

export const createWindow = native.definePlatform({ ios, android });
