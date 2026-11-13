import { patcher } from '@unbound-app/api';

import { patchDecorations, restoreDecorations } from '~/patches';

export function start() {
	patchDecorations();
}

export function stop() {
	patcher.unpatchAll();
	restoreDecorations();
}
