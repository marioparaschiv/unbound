import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { clearEntries } from '~/lib/cache';
import { patchMessageRows } from '~/patches';

export function start(context: PluginContext) {
	patchMessageRows(context.native);
}

export function stop() {
	clearEntries();
	patcher.unpatchAll();
}
