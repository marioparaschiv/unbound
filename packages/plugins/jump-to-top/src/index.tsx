import { patcher } from '@unbound-app/api';

import { patchChannelActions } from '~/patches';

export function start() {
	patchChannelActions();
}

export function stop() {
	patcher.unpatchAll();
}
