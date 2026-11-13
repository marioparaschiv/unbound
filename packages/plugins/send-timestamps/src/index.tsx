import { patcher } from '@unbound-app/api';

import { registerTimestamp } from '~/commands';
import { patchPickerButton, patchSentTimes } from '~/patches';

export function start() {
	patchSentTimes();
	patchPickerButton();
	registerTimestamp();
}

export function stop() {
	patcher.unpatchAll();
}
