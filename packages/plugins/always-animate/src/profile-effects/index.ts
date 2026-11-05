import { ProfileEffectLayer } from '~/profile-effects/modules';
import { forceProps } from '~/force/patches';

/**
 * @description Animates profile effects by setting `animate` on every `ProfileEffectLayer`, the iOS or Android layer file.
 * @returns A function that removes the patch.
 */
export function animateProfileEffects(): () => void {
	return forceProps(ProfileEffectLayer, { animate: true });
}
