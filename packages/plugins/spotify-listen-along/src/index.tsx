import { featureSelfTest, recordFailure } from '@unbound-plugins/shared/lifecycle/health';

import { startListenAlongInvite } from '~/invite';
import { startListenAlong } from '~/listen';

// One feature failing to start must not take the other down.
function startFeature(name: string, feature: () => void) {
	try {
		feature();
	} catch (error) {
		recordFailure(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		console.error(`[Spotify Listen Along] Failed to start ${name}:`, error);
	}
}

export function start() {
	startFeature('listen along', startListenAlong);
	startFeature('invite', startListenAlongInvite);
}

export { featureSelfTest as selfTest };
