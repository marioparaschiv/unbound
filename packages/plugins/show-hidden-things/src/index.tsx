import { patcher } from '@unbound-app/api';

import { patchInvitePermissions, patchMessageRows } from '~/patches';

export function start() {
	patchMessageRows();
	patchInvitePermissions();
}

export function stop() {
	patcher.unpatchAll();
}
