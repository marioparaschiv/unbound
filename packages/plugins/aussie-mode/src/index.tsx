import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { turnScreenBack, turnScreenOver } from '~/native/views';
import { patchMessageActions } from '~/patches';

export async function start(context: PluginContext) {
	patchMessageActions();
	// `start` waits for the first rotation.
	await turnScreenOver(context.native);
}

export async function stop() {
	patcher.unpatchAll();
	await turnScreenBack();
}
