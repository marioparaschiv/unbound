import { patcher } from '@unbound-app/api';

import { patchMultiAccountStore, redrawMultiAccount } from '~/patches';

export function start() {
	patchMultiAccountStore();
}

export function stop() {
	patcher.unpatchAll();
	redrawMultiAccount();
}
