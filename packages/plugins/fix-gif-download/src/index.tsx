import { patcher } from '@unbound-app/api';

import { patchMediaManager, patchMediaShareActions } from '~/patches';

export function start() {
	patchMediaShareActions();
	patchMediaManager();
}

export function stop() {
	patcher.unpatchAll();
}
