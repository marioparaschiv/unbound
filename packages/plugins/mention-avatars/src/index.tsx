import type { PluginContext } from '@unbound-app/api/native';

import { avatarsSelfTest, startAvatars, stopAvatars } from '~/avatars';

export function start(context: PluginContext) {
	startAvatars(context);
}

export function stop() {
	stopAvatars();
}

export { avatarsSelfTest as selfTest };
