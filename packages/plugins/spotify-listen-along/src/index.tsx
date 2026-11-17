import { patcher } from '@unbound-app/api';

import { patchActivityButtons, patchInviteJoin, patchMediaKeyboardActions } from '~/patches';
import { endSessions } from '~/lib/session';

export function start() {
	patchActivityButtons();
	patchMediaKeyboardActions();
	patchInviteJoin();
}

export function stop() {
	endSessions();
	patcher.unpatchAll();
}
