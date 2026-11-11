import { patcher } from '@unbound-app/api';

import { patchUserProfilePrimaryInfo } from '~/patches/user-profile';
import { patchPresenceStore } from '~/patches/presence-store';
import { patchMessageRows } from '~/patches/message-rows';
import { patchUserRow } from '~/patches/user-row';

// Each patch reads its setting when it runs, so a switch applies at once.
export function start() {
	patchUserRow();
	patchUserProfilePrimaryInfo();
	patchMessageRows();
	patchPresenceStore();
}

export function stop() {
	patcher.unpatchAll();
}

export { SettingsPanel } from '~/settings';
