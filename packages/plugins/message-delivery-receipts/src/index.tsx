import { patcher } from '@unbound-app/api';

import { followSentMessages } from '~/flux/sent-here';
import { patchMessageRows } from '~/patches';

export function start() {
	followSentMessages();
	patchMessageRows();
}

export function stop() {
	patcher.unpatchAll();
}
