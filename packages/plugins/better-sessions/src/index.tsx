import { patcher } from '@unbound-app/api';

import { startBackgroundCheck } from '~/lib/background';
import { patchSessionRows } from '~/patches/session-rows';

export function start() {
	patchSessionRows();
	startBackgroundCheck();
}

export function stop() {
	patcher.unpatchAll();
}
