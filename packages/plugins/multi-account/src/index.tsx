import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startMultiAccount, stopMultiAccount } from '~/multi-account';

export function start() {
	startMultiAccount();
}

export function stop() {
	stopMultiAccount();
}

export { featureSelfTest as selfTest };
