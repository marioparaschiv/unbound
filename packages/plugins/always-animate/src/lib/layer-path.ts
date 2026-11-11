import { definePlatform } from '@unbound-app/api/native';

import { PROFILE_EFFECT_LAYER_PATH as android } from '~/lib/layer-path-android';
import { PROFILE_EFFECT_LAYER_PATH as ios } from '~/lib/layer-path-ios';

/** The source path of Discord's profile effect layer, which differs by platform. */
export const PROFILE_EFFECT_LAYER_PATH = definePlatform({ ios, android });
