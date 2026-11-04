import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startListenAlongInvite } from '~/invite';
import { startListenAlong } from '~/listen';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	dispose = applyFeatures(PLUGIN_NAME, [
		() => startListenAlong(),
		() => startListenAlongInvite(),
	]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest };
