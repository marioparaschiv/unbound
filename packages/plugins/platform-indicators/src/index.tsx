import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchUserProfilePrimaryInfo } from '~/patches/user-profile';
import { patchPresenceStore } from '~/patches/presence-store';
import { patchMessageRows } from '~/patches/message-rows';
import { patchUserRow } from '~/patches/user-row';
import { startNameRoom, stopNameRoom } from '~/native/name-room';

// Each patch reads its setting when it runs, so a switch applies at once.
export function start(context: PluginContext) {
	patchUserRow();
	patchUserProfilePrimaryInfo();
	patchMessageRows();
	patchPresenceStore();
	startNameRoom(context);
}

export async function stop() {
	await stopNameRoom();
	patcher.unpatchAll();
}

export { SettingsPanel } from '~/settings';
