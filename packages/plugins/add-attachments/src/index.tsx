import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';

import { startEditUploads } from '~/editing';
import { startSheet } from '~/sheet';
import { PLUGIN_NAME } from '~/constants';

let stopFeatures = async () => {};

export function start() {
	stopFeatures = startFeatures(PLUGIN_NAME, [startEditUploads, startSheet]);
}

export function stop() {
	return stopFeatures();
}

export { featureSelfTest as selfTest };
