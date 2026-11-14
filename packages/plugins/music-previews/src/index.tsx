import { patcher } from '@unbound-app/api';

import { patchMusicLinks, stopPreviews } from '~/patches';

export function start() {
	patchMusicLinks();
}

export function stop() {
	patcher.unpatchAll();
	stopPreviews();
}
