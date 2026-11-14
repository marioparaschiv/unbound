import { patcher } from '@unbound-app/api';

import { patchAvatar } from '~/patches';

export function start() {
	patchAvatar();
}

export function stop() {
	patcher.unpatchAll();
}
