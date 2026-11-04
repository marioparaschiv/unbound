import { featureSelfTest, recordFailure } from '@unbound-plugins/shared/lifecycle/health';

import { startRequests, stopRequests } from '~/requests';
import { startPicker, stopPicker } from '~/picker';

export function start() {
	const failures: string[] = [];

	// One feature throwing must not cost the other.
	for (const [name, startFeature] of [
		['picker', startPicker],
		['requests', startRequests],
	] as const) {
		try {
			startFeature();
		} catch (error) {
			logger.error(`Failed to start the ${name}:`, error);
			failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// Recorded last, because recording an applied feature clears an earlier failure.
	if (failures.length) recordFailure(failures.join('; '));
}

export function stop() {
	stopRequests();
	stopPicker();
}

export { featureSelfTest as selfTest };
