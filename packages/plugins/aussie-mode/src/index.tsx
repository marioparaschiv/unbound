import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { turnScreenBack, turnScreenOver } from '~/native/views';
import { patchMessageActions } from '~/patches';

// Off an Australian device each feature returns at once, and the plugin has no self test the device matrix would fail.
export async function start(context: PluginContext) {
	patchMessageActions();
	// `start` waits for the first rotation.
	await turnScreenOver(context.native);
}

export async function stop() {
	patcher.unpatchAll();
	await turnScreenBack();
}
