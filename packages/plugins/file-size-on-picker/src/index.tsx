import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchMediaKeyboardItem } from '~/patches';
import { releaseFileSizes } from '~/native/calls';

export function start(context: PluginContext) {
	patchMediaKeyboardItem(context);
}

export function stop() {
	patcher.unpatchAll();
	releaseFileSizes();
}
