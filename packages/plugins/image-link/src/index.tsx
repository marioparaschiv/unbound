import { patcher } from '@unbound-app/api';

import { patchSimpleEmbedCheck } from '~/patches';

export function start() {
	patchSimpleEmbedCheck();
}

export function stop() {
	patcher.unpatchAll();
}
