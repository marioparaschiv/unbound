import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchMediaModalYoutubeEmbedError } from '~/patches/media-modal-youtube-embed-error';
import { patchMediaModalYoutube } from '~/patches/media-modal-youtube';
import { loadSelfTest } from '~/load-status';
import { loadStatus } from '~/viewer-state';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	dispose = applyFeatures(PLUGIN_NAME, [
		patchMediaModalYoutube,
		patchMediaModalYoutubeEmbedError,
	]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

function selfTest() {
	return loadSelfTest(featureSelfTest(), loadStatus.pending());
}

export default { start, stop, selfTest };
