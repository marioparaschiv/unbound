import { patcher } from '@unbound-app/api';

import { patchChannelRecord } from '~/patches';

export function start() {
	patchChannelRecord();
}

export function stop() {
	patcher.unpatchAll();
}
