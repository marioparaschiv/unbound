import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startNames } from '~/names';

export function start() {
	startNames();
}

export { featureSelfTest as selfTest };
