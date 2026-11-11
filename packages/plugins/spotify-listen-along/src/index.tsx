import { patcher } from '@unbound-app/api';

import { patchActivityButtons, patchMediaKeyboardActions } from '~/patches';

export function start() {
	patchActivityButtons();
	patchMediaKeyboardActions();
}

export function stop() {
	patcher.unpatchAll();
}
