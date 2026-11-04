import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startAnonymise } from '~/anonymise';

export function start() {
	startAnonymise();
}

export { featureSelfTest as selfTest };
