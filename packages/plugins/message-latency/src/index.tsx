import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { startLatencyIndicator, stopLatencyIndicator } from '~/latency-indicator';

export function start(context: PluginContext) {
	startLatencyIndicator(context);
}

export function stop() {
	return stopLatencyIndicator();
}

export { featureSelfTest as selfTest };
