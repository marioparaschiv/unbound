import { patcher } from '@unbound-app/api';

import { patchInlineCodeTaps } from '~/patches';

export function start() {
	patchInlineCodeTaps();
}

export function stop() {
	patcher.unpatchAll();
}
