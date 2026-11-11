import { patcher } from '@unbound-app/api';

import { patchMediaModalYoutube, patchMediaModalYoutubeEmbedError } from '~/patches';
import { loadSelfTest } from '~/lib/load-status';
import { loadStatus } from '~/lib/viewer-state';

export function start() {
	patchMediaModalYoutube();
	patchMediaModalYoutubeEmbedError();
}

export function stop() {
	patcher.unpatchAll();
}

export function selfTest() {
	return loadSelfTest(loadStatus.pending());
}
