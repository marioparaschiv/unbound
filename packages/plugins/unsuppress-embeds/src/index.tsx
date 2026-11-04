import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startUnsuppress, stopUnsuppress } from '~/unsuppress';

export function start() {
	startUnsuppress();
}

export function stop() {
	stopUnsuppress();
}

export { featureSelfTest as selfTest };
