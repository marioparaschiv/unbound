import { patcher } from '@unbound-app/api';

import { forgetFirstMessages } from '~/lib/first-message';
import { patchJumpToPresent } from '~/patches';
import { patchChannelSheets } from '~/sheet-row';

export function start() {
	patchJumpToPresent();
	patchChannelSheets();
}

export function stop() {
	patcher.unpatchAll();
	forgetFirstMessages();
}
