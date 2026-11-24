import { storage } from '@unbound-app/api';

import { storedSpeedFor } from '~/lib/speeds';

/**
 * @description Turns the `1` and `2` speeds 1.6.0 and earlier stored into `1.0` and `2.0`, which the schema would
 * otherwise reset. Does nothing once the speed is current.
 */
export function migrateSettings(): void {
	const bucket = storage.getBucket();
	const stored: unknown = bucket.get('speed', undefined);
	const speed = storedSpeedFor(stored);

	if (stored === undefined || stored === speed) return;

	if (speed) {
		bucket.set('speed', speed);
	} else {
		bucket.remove('speed');
	}
}

export default migrateSettings;
