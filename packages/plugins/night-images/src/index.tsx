import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchRowManager } from '~/patches/row-manager';
import { dimEmbeds } from '~/native/embeds';

let stopEmbeds: (() => Promise<void>) | undefined;

export function start(context: PluginContext) {
	patchRowManager();
	stopEmbeds = dimEmbeds(context.native);
}

export async function stop() {
	patcher.unpatchAll();
	await stopEmbeds?.();
	stopEmbeds = undefined;
}
