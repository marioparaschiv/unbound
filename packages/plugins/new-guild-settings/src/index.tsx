import { patcher } from '@unbound-app/api';

import { patchActionSheets, patchContextMenus } from '~/patches';
import { migrateSettings } from '~/lib/settings-migration';
import { listenToJoins } from '~/flux/listeners';

export function start() {
	migrateSettings();
	listenToJoins();
	patchActionSheets();
	patchContextMenus();
}

export function stop() {
	patcher.unpatchAll();
}
