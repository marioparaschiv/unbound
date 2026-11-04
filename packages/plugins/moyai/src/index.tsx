import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startMoyai, stopMoyai } from '~/moyai';

export function start() {
	startMoyai();
}

export function stop() {
	stopMoyai();
}

export { featureSelfTest as selfTest };
