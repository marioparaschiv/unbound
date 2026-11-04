import { featureSelfTest, recordFailure } from '@unbound-plugins/shared/lifecycle/health';

import { startEditUploads } from '~/editing';
import { startSheet } from '~/sheet';

let stops: (() => void)[] = [];

// One feature failing to start must not take the other down.
function startFeature(name: string, feature: () => () => void) {
	try {
		stops.push(feature());
	} catch (error) {
		recordFailure(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		console.error(`[Add Attachments] Failed to start ${name}:`, error);
	}
}

export function start() {
	startFeature('editing', startEditUploads);
	startFeature('sheet', startSheet);
}

export function stop() {
	for (const stopFeature of stops.reverse()) stopFeature();

	stops = [];
}

export { featureSelfTest as selfTest };
