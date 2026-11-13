import { patcher } from '@unbound-app/api';

import { patchFriendRequestCount, patchMessageRequestCount } from '~/patches';

export function start() {
	patchFriendRequestCount();
	patchMessageRequestCount();
}

export function stop() {
	patcher.unpatchAll();
}
