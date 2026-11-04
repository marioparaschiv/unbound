import { native } from '@unbound-app/api';

import { PROFILE_EFFECT_LAYER_PATH as android } from '~/profile-effects/android/layer-path';
import { PROFILE_EFFECT_LAYER_PATH as ios } from '~/profile-effects/ios/layer-path';
import { forceProps } from '~/force/patches';

/**
 * @description Animates profile effects by setting `animate` on every `ProfileEffectLayer`.
 * @returns A function that removes the patch.
 */
export function animateProfileEffects(): () => void {
	return forceProps(native.definePlatform({ ios, android }), { animate: true });
}
