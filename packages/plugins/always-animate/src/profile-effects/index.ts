import { forceProps } from '~/force/patches';
import { PROFILE_EFFECT_LAYER_PATH } from '~/constants';

/**
 * @description Animates profile effects by setting `animate` on every `ProfileEffectLayer`.
 * @returns A function that removes the patch.
 */
export function animateProfileEffects(): () => void {
	return forceProps(PROFILE_EFFECT_LAYER_PATH, { animate: true });
}
