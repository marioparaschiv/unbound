import { flux, patcher } from '@unbound-app/api';

import { createTimezoneLookup } from '~/lib/lookup';
import { patchMessageTimes } from '~/patches/messages';
import { patchProfileTime } from '~/patches/profile';
import { useLookup } from '~/lib/timezone';

let unpatchMessages: (() => void) | undefined;

export function start() {
	useLookup(createTimezoneLookup(() => flux.getStore('Message').emitChange?.()));
	unpatchMessages = patchMessageTimes();
	patchProfileTime();
}

export function stop() {
	unpatchMessages?.();
	unpatchMessages = undefined;
	patcher.unpatchAll();
	useLookup(undefined);
}
