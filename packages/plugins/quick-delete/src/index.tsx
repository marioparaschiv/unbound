import { patcher } from '@unbound-app/api';

import { patchDeleteConfirmation } from '~/patches';

export function start() {
	patchDeleteConfirmation();
}

export function stop() {
	patcher.unpatchAll();
}
