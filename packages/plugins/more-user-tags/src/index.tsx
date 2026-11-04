import type { PluginContext } from '@unbound-app/api/native';

import { startTags, stopTags, tagsSelfTest } from '~/tags';

export function start(context: PluginContext) {
	startTags(context);
}

export function stop() {
	return stopTags();
}

export { tagsSelfTest as selfTest };
