import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startImages } from '~/images';

export function start() {
	startImages();
}

export { featureSelfTest as selfTest };
