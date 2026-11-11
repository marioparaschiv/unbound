import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { forceProps } from '~/patches/force';

function enable(): () => void {
	return forceProps('modules/collectibles/nameplates/native/Nameplate.tsx', {
		animate: true,
		loop: true,
	});
}

/**
 * @description Plays nameplates on a loop instead of only while they are pressed or focused, while the `nameplates` setting is on.
 * Sets `animate` and `loop` on `Nameplate`, which passes them to `NameplateInner`.
 */
export function animateNameplates(): void {
	whileEnabled('nameplates', enable);
}
