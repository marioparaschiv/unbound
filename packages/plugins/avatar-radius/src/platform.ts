import { native } from '@unbound-app/api';

import { roundAndroidAvatars as android } from '~/android/avatars';
import { roundIOSAvatars as ios } from '~/ios/avatars';

export const roundAvatars = native.definePlatform({ ios, android });
