import { patcher } from '@unbound-app/api';

import { patchSpamCheck } from '~/patches';

export function start() {
	patchSpamCheck();
}

export function stop() {
	patcher.unpatchAll();
}
