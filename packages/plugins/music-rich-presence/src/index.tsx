import { patcher } from '@unbound-app/api';

import { startPresence, stopPresence } from '~/lib/presence';

export function start() {
	startPresence();
}

export function stop() {
	patcher.unpatchAll();
	stopPresence();
}
