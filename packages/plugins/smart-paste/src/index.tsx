import type { PluginContext } from '@unbound-app/api/native';

import { patchPasteButton } from '~/patches';

export function start(context: PluginContext) {
	patchPasteButton(context.tempPath);
}
