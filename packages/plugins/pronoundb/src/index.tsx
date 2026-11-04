import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startPronouns, stopPronouns } from '~/pronouns';

export function start() {
	startPronouns();
}

export function stop() {
	stopPronouns();
}

export { featureSelfTest as selfTest };
