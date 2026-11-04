import { native } from '@unbound-app/api';

import { createWindow as android } from '~/picture-in-picture/android/window';
import { createWindow as ios } from '~/picture-in-picture/ios/window';

export const createWindow = native.definePlatform({ ios, android });
