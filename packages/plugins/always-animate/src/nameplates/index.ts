import { forceProps } from '~/force/patches';
import { NAMEPLATE_PATH } from '~/constants';

/**
 * @description Plays nameplates on a loop instead of only while they are pressed or focused.
 * Sets `animate` and `loop` on `Nameplate`, which passes them to `NameplateInner`.
 * @returns A function that removes the patch.
 */
export function animateNameplates(): () => void {
	return forceProps(NAMEPLATE_PATH, { animate: true, loop: true });
}
