import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { startFileSizes } from '~/file-sizes';

let releaseFileSizes = () => {};

export function start(context: PluginContext) {
	releaseFileSizes = startFileSizes(context);
}

export function stop() {
	releaseFileSizes();
	releaseFileSizes = () => {};
}

export { featureSelfTest as selfTest };
