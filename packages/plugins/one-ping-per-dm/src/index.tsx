import { patcher } from '@unbound-app/api';

import { interceptMessageCreate } from '~/flux/interceptors';
import { readStateSelfTest } from '~/lib/read-state';
import { clearRecentMessages } from '~/lib/sound-target';
import { patchPlayInAppMessageSound } from '~/patches';

export function start() {
	interceptMessageCreate();
	patchPlayInAppMessageSound();
}

export function stop() {
	patcher.unpatchAll();
	clearRecentMessages();
}

export function selfTest() {
	return readStateSelfTest();
}
