import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startRequests, stopRequests } from '~/requests';
import { startPicker, stopPicker } from '~/picker';

export function start() {
	startPicker();
	startRequests();
}

export function stop() {
	stopRequests();
	stopPicker();
}

export { featureSelfTest as selfTest };
