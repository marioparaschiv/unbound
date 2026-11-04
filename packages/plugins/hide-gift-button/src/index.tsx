import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startGift } from '~/gift';

let stopGift = async () => {};

export function start() {
	stopGift = startGift();
}

export function stop() {
	return stopGift();
}

export { featureSelfTest as selfTest };
