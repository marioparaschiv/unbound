import { patcher } from '@unbound-app/api';

import { patchWebView } from '~/patches';

export function start() {
	patchWebView();
}

export function stop() {
	patcher.unpatchAll();
}
