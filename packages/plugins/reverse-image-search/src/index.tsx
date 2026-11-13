import { patcher } from '@unbound-app/api';

import { patchMediaShareActions } from '~/patches/share-actions';

export function start() {
	patchMediaShareActions();
}

export function stop() {
	patcher.unpatchAll();
}
