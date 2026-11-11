import { patcher } from '@unbound-app/api';

import { patchGifPickerHeader } from '~/patches/gif-picker-header';
import { patchRest, restoreTrending } from '~/patches/rest';
import { markPickerStopped } from '~/lib/picker-running';

export function start() {
	patchGifPickerHeader();
	patchRest();
}

export function stop() {
	// The patches go first, or Discord's trending refresh would be answered by the provider.
	patcher.unpatchAll();
	restoreTrending();
	markPickerStopped();
}
