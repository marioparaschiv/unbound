import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startReviews } from '~/reviews';

export function start() {
	startReviews();
}

export { featureSelfTest as selfTest };
