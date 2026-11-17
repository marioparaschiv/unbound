import { patcher } from '@unbound-app/api';

import { forgetBadges, patchProfileBadges } from '~/patches';

let stopWaiting: (() => void) | undefined;

export function start() {
	stopWaiting = patchProfileBadges();
}

export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	patcher.unpatchAll();
	forgetBadges();
}
