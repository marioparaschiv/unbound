import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startTimeoutRemaining } from '~/timeout-remaining';

export function start() {
	startTimeoutRemaining();
}

export { featureSelfTest as selfTest };
