import { patcher } from '@unbound-app/api';

import { registerStatsCommand } from '~/commands';
import { patchChatInput } from '~/patches';

export function start() {
	patchChatInput();
	registerStatsCommand();
}

export function stop() {
	patcher.unpatchAll();
}
