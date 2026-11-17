import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchActionSheets } from '~/patches';

export function start(context: PluginContext) {
	patchActionSheets(context.native, context.tempPath);
}

export function stop() {
	patcher.unpatchAll();
}
