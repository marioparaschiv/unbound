import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchMultiAccountStore } from '~/patches/multi-account-store';
import { MultiAccountStore } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Multi Account', { MultiAccountStore })) return;

	dispose = applyFeatures('Multi Account', [patchMultiAccountStore]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
