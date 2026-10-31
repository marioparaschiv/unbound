import { native } from '@unbound-app/api';

import { createFileSizes as android } from '~/file-sizes/android/file-sizes';
import { createFileSizes as ios } from '~/file-sizes/ios/file-sizes';

export const createFileSizes = native.definePlatform({ ios, android });
