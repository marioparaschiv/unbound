import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchMediaShareActions } from '~/patches/media-share-actions';
import { patchMediaManager } from '~/patches/media-manager';

let dispose = () => {};

function start() {
	dispose = applyFeatures('Fix GIF Downloads', [patchMediaShareActions, patchMediaManager]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop, selfTest: featureSelfTest };
