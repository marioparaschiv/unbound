import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startCrown } from '~/crown';

export function start() {
	startCrown();
}

export { featureSelfTest as selfTest };
