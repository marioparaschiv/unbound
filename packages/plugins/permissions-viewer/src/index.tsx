import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startViewer } from '~/viewer';

export function start() {
	startViewer();
}

export { featureSelfTest as selfTest };
