import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startViewRaw } from '~/raw';

export function start() {
	startViewRaw();
}

export { featureSelfTest as selfTest };
