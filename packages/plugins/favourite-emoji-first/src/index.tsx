import { patcher } from '@unbound-app/api';

import { patchEmojiAutocomplete } from '~/patches';

export function start() {
	patchEmojiAutocomplete();
}

export function stop() {
	patcher.unpatchAll();
}
