import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startViewRaw } from '~/raw';

let stopViewRaw = async () => {};

export function start() {
	stopViewRaw = startViewRaw();
}

export function stop() {
	return stopViewRaw();
}

export { featureSelfTest as selfTest };
