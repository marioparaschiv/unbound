import { patcher } from '@unbound-app/api';

import { patchEllipsis } from '~/patches';

export function start() {
	patchEllipsis();
}

export function stop() {
	patcher.unpatchAll();
}
