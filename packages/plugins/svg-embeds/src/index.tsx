import type { NativeBridge, PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { clearEntries } from '~/lib/cache';
import { patchMessageRows } from '~/patches';
import { selfTestRaster } from '~/self-test';

let bridge: NativeBridge | undefined;

export function start(context: PluginContext) {
	bridge = context.native;
	patchMessageRows(context.native);
}

export function stop() {
	bridge = undefined;
	clearEntries();
	patcher.unpatchAll();
}

export function selfTest() {
	return bridge ? selfTestRaster(bridge) : { ok: false, detail: 'not started' };
}
