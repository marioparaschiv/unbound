import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startAnimate } from '~/animate';

export function start() {
	startAnimate();
}

export { featureSelfTest as selfTest };
