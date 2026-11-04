import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startStillDots } from '~/still-dots';

export function start() {
	startStillDots();
}

export { featureSelfTest as selfTest };
