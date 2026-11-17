import { patcher } from '@unbound-app/api';

import { keepRepliesFromDirectClears, patchMessageActions, patchReplyActions } from '~/patches';

export function start() {
	patchReplyActions();
	keepRepliesFromDirectClears();
	patchMessageActions();
}

export function stop() {
	patcher.unpatchAll();
}
