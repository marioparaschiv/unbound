import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startSilent } from '~/silent';

export function start() {
	startSilent();
}

export { featureSelfTest as selfTest };
