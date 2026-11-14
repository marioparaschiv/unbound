import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchShareActions } from '~/patches';

let stopWaiting: (() => void) | undefined;

export function start(context: PluginContext) {
	stopWaiting = patchShareActions(context.native);
}

export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	patcher.unpatchAll();
}
