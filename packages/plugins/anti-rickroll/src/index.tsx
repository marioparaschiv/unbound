import { patcher } from '@unbound-app/api';

import { patchLinkTaps } from '~/patches';

export function start() {
	patchLinkTaps();
}

export function stop() {
	patcher.unpatchAll();
}
