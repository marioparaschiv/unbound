import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { drawIndicators, removeIndicators } from '~/native/indicators';
import { listenToMessages } from '~/flux/listeners';
import { patchMessageRows } from '~/patches';

export function start(context: PluginContext) {
	drawIndicators(context);
	patchMessageRows();
	listenToMessages(context);
}

export async function stop() {
	patcher.unpatchAll();
	await removeIndicators();
}
