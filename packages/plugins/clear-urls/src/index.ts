import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchMessageActions } from '~/patches/message-actions';
import { MessageActions } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Clear URLs', { MessageActions })) return;

	dispose = applyFeatures('Clear URLs', [patchMessageActions]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
