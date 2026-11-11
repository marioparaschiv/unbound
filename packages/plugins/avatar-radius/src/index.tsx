import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { hookAvatarViews, restoreAvatarCircles, selfTestAvatars } from '~/native/hooks';

export function start(context: PluginContext) {
	hookAvatarViews(context);
}

export async function stop() {
	patcher.unpatchAll();
	await restoreAvatarCircles();
}

export function selfTest() {
	return selfTestAvatars();
}
