import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startAnonymise } from '~/anonymise';

let stopAnonymise = async () => {};

export function start() {
	stopAnonymise = startAnonymise();
}

export function stop() {
	return stopAnonymise();
}

export { featureSelfTest as selfTest };
