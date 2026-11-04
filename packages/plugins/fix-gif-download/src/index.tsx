import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';

import { startShareActions } from '~/share';
import { startDownloads } from '~/download';
import { PLUGIN_NAME } from '~/constants';

let stopFeatures = async () => {};

export function start() {
	stopFeatures = startFeatures(PLUGIN_NAME, [startShareActions, startDownloads]);
}

export function stop() {
	return stopFeatures();
}

export { featureSelfTest as selfTest };
