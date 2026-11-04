import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startBlocked, stopBlocked } from '~/blocked';

export function start() {
	startBlocked();
}

export function stop() {
	stopBlocked();
}

export { featureSelfTest as selfTest };
