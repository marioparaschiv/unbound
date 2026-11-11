import { patcher } from '@unbound-app/api';

import { patchBurstReactionToggle } from '~/patches';
import { interceptBurstEffects } from '~/flux/interceptors';

export function start() {
	patchBurstReactionToggle();
	interceptBurstEffects();
}

export function stop() {
	patcher.unpatchAll();
}
