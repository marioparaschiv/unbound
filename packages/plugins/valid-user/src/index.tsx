import { patcher } from '@unbound-app/api';

import { patchMentionTaps } from '~/patches';

export function start() {
	patchMentionTaps();
}

export function stop() {
	patcher.unpatchAll();
}
