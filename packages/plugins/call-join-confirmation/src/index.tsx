import { patcher } from '@unbound-app/api';

import { patchCalls, patchVoiceJoins } from '~/patches';

export function start() {
	patchVoiceJoins();
	patchCalls();
}

export function stop() {
	patcher.unpatchAll();
}
