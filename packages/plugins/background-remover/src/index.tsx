import type { PluginContext } from '@unbound-app/api/native';

import { patchActionSheets } from '~/patches';

export function start(context: PluginContext) {
	patchActionSheets(context.native, context.tempPath);
}
