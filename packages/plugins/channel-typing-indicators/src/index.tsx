import { patcher } from '@unbound-app/api';

import { patchThreadChannel } from '~/patches/thread-channel';
import { patchTextChannel } from '~/patches/text-channel';

export { SettingsPanel } from '~/settings';

export function start() {
	patchTextChannel();
	patchThreadChannel();
}

export function stop() {
	patcher.unpatchAll();
}
