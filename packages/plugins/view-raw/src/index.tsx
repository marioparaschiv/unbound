import { patcher } from '@unbound-app/api';

import { patchActionSheets } from '~/patches/action-sheets';
import { patchContextMenus } from '~/patches/context-menus';

export function start() {
	patchActionSheets();
	patchContextMenus();
}

export function stop() {
	patcher.unpatchAll();
}
