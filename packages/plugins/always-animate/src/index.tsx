import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startAnimate } from '~/animate';

let stopAnimate: (() => void) | undefined;

export function start() {
	stopAnimate = startAnimate();
}

export function stop() {
	stopAnimate?.();
	stopAnimate = undefined;
}

export { featureSelfTest as selfTest };
