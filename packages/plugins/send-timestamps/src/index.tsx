import { patcher } from '@unbound-app/api';

import { registerTimestamp } from '~/commands';
import { patchSentTimes } from '~/patches';

export function start() {
	patchSentTimes();
	registerTimestamp();
}

export function stop() {
	patcher.unpatchAll();
}
