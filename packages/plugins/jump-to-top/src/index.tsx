import { patcher } from '@unbound-app/api';

import { forgetFirstMessages } from '~/lib/first-message';
import { patchJumpToPresent } from '~/patches';

export function start() {
	patchJumpToPresent();
}

export function stop() {
	patcher.unpatchAll();
	forgetFirstMessages();
}
