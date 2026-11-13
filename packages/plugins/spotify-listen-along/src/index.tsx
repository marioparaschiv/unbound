import { patcher } from '@unbound-app/api';

import { patchActivityButtons, patchMediaKeyboardActions } from '~/patches';
import { endSessions } from '~/lib/session';

export function start() {
	patchActivityButtons();
	patchMediaKeyboardActions();
}

export function stop() {
	endSessions();
	patcher.unpatchAll();
}
