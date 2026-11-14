import { patcher } from '@unbound-app/api';

import { listenForOpenedFolders, patchClosedFolders, patchFolderMenus } from '~/patches';

export function start() {
	listenForOpenedFolders();
	patchClosedFolders();
	patchFolderMenus();
}

export function stop() {
	patcher.unpatchAll();
}
