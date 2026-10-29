import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import { whenAllLoaded } from '@unbound-plugins/shared/metro/when-loaded';

import { applyStickerPreview } from '~/preview';
import { RequiredModules } from '~/modules';

let dispose = () => {};

function start() {
	dispose = applyFeatures('Sticker Preview', [
		() => whenAllLoaded(RequiredModules, applyStickerPreview),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop, selfTest: featureSelfTest };
