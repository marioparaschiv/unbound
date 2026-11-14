import { patcher } from '@unbound-app/api';

import { patchChannelSheets } from '~/patches';

export function start() {
	patchChannelSheets();
}

export function stop() {
	patcher.unpatchAll();
}
