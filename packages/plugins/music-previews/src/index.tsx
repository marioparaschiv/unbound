import { patcher } from '@unbound-app/api';

import { clearClips, patchMusicEmbeds } from '~/patches';

export function start() {
	patchMusicEmbeds();
}

export function stop() {
	patcher.unpatchAll();
	clearClips();
}
