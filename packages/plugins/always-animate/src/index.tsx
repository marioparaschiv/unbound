import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startAnimate } from '~/animate';

let stopAnimate = async () => {};

export function start() {
	stopAnimate = startAnimate();
}

export function stop() {
	return stopAnimate();
}

export { featureSelfTest as selfTest };
