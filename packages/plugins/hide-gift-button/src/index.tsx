import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startGift } from '~/gift';

export function start() {
	startGift();
}

export { featureSelfTest as selfTest };
