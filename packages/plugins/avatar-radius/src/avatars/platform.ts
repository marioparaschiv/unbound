import { native } from '@unbound-app/api';

import { roundAndroidAvatars as android } from '~/avatars/android/avatars';
import { roundIOSAvatars as ios } from '~/avatars/ios/avatars';

export const roundAvatars = native.definePlatform({ ios, android });
