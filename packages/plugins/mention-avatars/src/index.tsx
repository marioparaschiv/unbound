import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { drawMentionAvatars, restoreMentionText, selfTest } from '~/native/views';

export function start(context: PluginContext) {
	drawMentionAvatars(context);
}

export function stop() {
	patcher.unpatchAll();
	restoreMentionText();
}

export { selfTest };
