import { native } from '@unbound-app/api';

import { createFileSizeLookup as android } from '~/file-sizes/android/file-sizes';
import { createFileSizeLookup as ios } from '~/file-sizes/ios/file-sizes';

export const createFileSizeLookup = native.definePlatform({ ios, android });
