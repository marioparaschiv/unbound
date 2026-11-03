import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { StillDotsRunning } from '~/modules';
import { patchEllipsis } from '~/patches/ellipsis';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	dispose = applyFeatures(PLUGIN_NAME, [StillDotsRunning.markRunning, patchEllipsis]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default { start, stop, selfTest: featureSelfTest };
