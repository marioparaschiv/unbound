import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { PluginContext } from '@unbound-app/api/native';

import { isAussieDevice } from '~/locale';
import { startRotation } from '~/rotation';

let dispose = () => {};

function start(context: PluginContext) {
	if (!isAussieDevice()) return;

	dispose = applyFeatures('Aussie Mode', [
		() => startRotation(context.native, (error) => console.error('[Aussie Mode]', error)),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
