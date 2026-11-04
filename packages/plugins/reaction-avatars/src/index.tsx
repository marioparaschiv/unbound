import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { startReactions } from '~/reactions';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start(context: PluginContext) {
	dispose = startReactions(context) ?? (() => undefined);
}

export function stop() {
	const finished = dispose();

	dispose = () => undefined;

	return finished;
}

export { featureSelfTest as selfTest };
