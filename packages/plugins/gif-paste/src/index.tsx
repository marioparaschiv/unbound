import { patcher } from '@unbound-app/api';

import { patchMessageActions, patchReplyActions } from '~/patches';

export function start() {
	patchReplyActions();
	patchMessageActions();
}

export function stop() {
	patcher.unpatchAll();
}
