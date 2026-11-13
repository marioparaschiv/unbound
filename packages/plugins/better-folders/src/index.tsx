import { patcher } from '@unbound-app/api';

import { listenForOpenedFolders, patchClosedFolders } from '~/patches';

export function start() {
	listenForOpenedFolders();
	patchClosedFolders();
}

export function stop() {
	patcher.unpatchAll();
}
