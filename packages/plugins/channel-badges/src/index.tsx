import { patcher } from '@unbound-app/api';

import { patchTextChannel } from '~/patches/text-channel';

export function start() {
	patchTextChannel();
}

export function stop() {
	patcher.unpatchAll();
}
