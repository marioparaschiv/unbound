import { native } from '@unbound-app/api';

import { reactionFeatures as android } from '~/android/features';
import { reactionFeatures as ios } from '~/ios/features';

export const reactionFeatures = native.definePlatform({ ios, android });
