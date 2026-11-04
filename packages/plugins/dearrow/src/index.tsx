import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startEmbeds } from '~/embeds';

let stopEmbeds: () => Promise<void> | void = () => undefined;

export function start() {
	stopEmbeds = startEmbeds();
}

export function stop() {
	const pending = stopEmbeds();

	stopEmbeds = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest };
