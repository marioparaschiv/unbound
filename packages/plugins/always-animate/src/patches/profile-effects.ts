import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { PROFILE_EFFECT_PATH } from '~/lib/constants';
import { forceProps } from '~/patches/force';

function enable(): () => void {
	return forceProps(PROFILE_EFFECT_PATH, { paused: false });
}

/**
 * @description Keeps profile effects playing while the `profileEffects` setting is on, by unpausing Discord's
 * `ProfileEffect`, which still plays each layer in its intro and loop order.
 */
export function animateProfileEffects(): void {
	whileEnabled('profileEffects', enable);
}
