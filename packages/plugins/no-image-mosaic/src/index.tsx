import type { PluginContext } from '@unbound-app/api/native';

import { stackMosaics } from '~/native/mosaic';

let unstack: (() => unknown) | undefined;

export function start(context: PluginContext) {
	unstack = stackMosaics(context.native);
}

export async function stop() {
	await unstack?.();
	unstack = undefined;
}
