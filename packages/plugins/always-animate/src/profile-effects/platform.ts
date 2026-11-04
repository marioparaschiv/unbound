import { definePlatform } from '@unbound-app/api/native';

import { PROFILE_EFFECT_LAYER_PATH as android } from '~/profile-effects/android/layer-path';
import { PROFILE_EFFECT_LAYER_PATH as ios } from '~/profile-effects/ios/layer-path';

export const PROFILE_EFFECT_LAYER_PATH = definePlatform({ ios, android });
