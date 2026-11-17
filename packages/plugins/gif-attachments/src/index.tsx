import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchGifSelections } from '~/patches';

export function start(context: PluginContext) {
	patchGifSelections(context.tempPath);
}

export function stop() {
	patcher.unpatchAll();
}
