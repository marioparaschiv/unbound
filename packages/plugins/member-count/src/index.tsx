import { patcher } from '@unbound-app/api';

import { patchMemberCountText } from '~/patches';

export function start() {
	patchMemberCountText();
}

export function stop() {
	patcher.unpatchAll();
}
