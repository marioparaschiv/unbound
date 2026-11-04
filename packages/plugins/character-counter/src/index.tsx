import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startCounter } from '~/counter';

export function start() {
	startCounter();
}

export { featureSelfTest as selfTest };
