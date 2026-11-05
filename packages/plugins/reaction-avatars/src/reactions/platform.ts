import { native } from '@unbound-app/api';

import { reactionFeatures as android } from '~/reactions/android/features';
import { reactionFeatures as ios } from '~/reactions/ios/features';

export const reactionFeatures = native.definePlatform({ ios, android });
