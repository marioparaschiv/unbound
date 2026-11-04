import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startPreview } from '~/preview';

export function start() {
	startPreview();
}

export { featureSelfTest as selfTest };
