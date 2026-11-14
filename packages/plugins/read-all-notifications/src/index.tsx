import { patcher } from '@unbound-app/api';

import { patchGuildsBar } from '~/patches';

export function start() {
	patchGuildsBar();
}

export function stop() {
	patcher.unpatchAll();
}
