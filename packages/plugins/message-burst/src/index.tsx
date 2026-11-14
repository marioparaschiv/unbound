import { patcher } from '@unbound-app/api';

import { patchSendMessage } from '~/patches';

export function start() {
	patchSendMessage();
}

export function stop() {
	patcher.unpatchAll();
}
