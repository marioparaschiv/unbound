import { featureSelfTest, recordFailure } from '@unbound-plugins/shared/lifecycle/health';

import { startInvitePermissions } from '~/invites';
import { startTimeoutIcons } from '~/timeouts';

const features = { 'timeout icons': startTimeoutIcons, 'paused invites': startInvitePermissions };

/** Starts each feature on its own, so one that throws is logged and recorded while the other still starts. */
export function start() {
	const failed: string[] = [];

	for (const [name, startFeature] of Object.entries(features)) {
		try {
			startFeature();
		} catch (error) {
			console.error(`[Show Hidden Things] Failed to start ${name}:`, error);
			failed.push(name);
		}
	}

	if (failed.length) recordFailure(`could not start ${failed.join(' and ')}`);
}

export { featureSelfTest as selfTest };
