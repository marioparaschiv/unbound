import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';

import { startListenAlongInvite } from '~/invite';
import { startListenAlong } from '~/listen';
import { PLUGIN_NAME } from '~/constants';

let stopFeatures = async () => {};

export function start() {
	stopFeatures = startFeatures(PLUGIN_NAME, [startListenAlong, startListenAlongInvite]);
}

export function stop() {
	return stopFeatures();
}

export { featureSelfTest as selfTest };
