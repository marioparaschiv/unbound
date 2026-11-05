import { metro } from '@unbound-app/api';

import { PROFILE_EFFECT_LAYER_PATH } from '~/profile-effects/platform';

export const ProfileEffectLayer = metro.findByFilePath(PROFILE_EFFECT_LAYER_PATH);
