import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startPresence, stopPresence } from '~/presence';

export function start() {
	startPresence();
}

/** Clears the activity the plugin sent, which the Addon scope cannot see. */
export function stop() {
	stopPresence();
}

export { featureSelfTest as selfTest };
