import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startEditUploads } from '~/editing';
import { startSheet } from '~/sheet';

let stopSheet = () => {};

export function start() {
	startEditUploads();
	stopSheet = startSheet();
}

export function stop() {
	stopSheet();
	stopSheet = () => {};
}

export { featureSelfTest as selfTest };
