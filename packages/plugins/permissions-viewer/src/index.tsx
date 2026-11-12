import { patcher } from '@unbound-app/api';

import { patchUserProfileRolesCard } from '~/patches/roles-card';
import { patchContextMenus } from '~/patches/context-menus';
import { patchActionSheets } from '~/patches/action-sheets';

export function start() {
	patchActionSheets();
	patchContextMenus();
	patchUserProfileRolesCard();
}

export function stop() {
	patcher.unpatchAll();
}
