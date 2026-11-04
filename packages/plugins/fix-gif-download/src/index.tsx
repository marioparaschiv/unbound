import { featureSelfTest, recordFailure } from '@unbound-plugins/shared/lifecycle/health';

import { startShareActions } from '~/share';
import { startDownloads } from '~/download';

// One feature failing to start must not take the other down.
function startFeature(name: string, feature: () => void) {
	try {
		feature();
	} catch (error) {
		recordFailure(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		console.error(`[Fix GIF Download] Failed to start ${name}:`, error);
	}
}

export function start() {
	startFeature('share actions', startShareActions);
	startFeature('downloads', startDownloads);
}

export { featureSelfTest as selfTest };
