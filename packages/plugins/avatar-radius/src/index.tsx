import type { PluginContext } from '@unbound-app/api/native';

import { selfTestAvatars, startAvatars, stopAvatars } from '~/avatars';

export function start(context: PluginContext) {
	startAvatars(context);
}

export function stop() {
	return stopAvatars();
}

export function selfTest() {
	return selfTestAvatars();
}
