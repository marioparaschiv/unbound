import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { PROFILE_EFFECT_LAYER_PATH } from '~/lib/layer-path';
import { forceProps } from '~/patches/force';

function enable(): () => void {
	return forceProps(PROFILE_EFFECT_LAYER_PATH, { animate: true });
}

/**
 * @description Animates profile effects while the `profileEffects` setting is on, by setting `animate` on every
 * `ProfileEffectLayer`, the iOS or Android layer file.
 */
export function animateProfileEffects(): void {
	whileEnabled('profileEffects', enable);
}
