import { createLogger } from '@unbound-app/logger';

import { getSetting, isSettingChange } from '~/settings/unbound';
import { Guilds, Users } from '~/metro/stores';
import { createPatcher } from '~/patcher/api';
import { findStore } from '~/metro/search';
import storage from '~/storage/api';

const Patcher = createPatcher('unbound::staff-mode');
const Logger = createLogger('StaffMode');

let unsubscribe: (() => void) | null = null;

/** Makes the developer experiment store report staff status from the `staff-mode` setting. */
export function start() {
	const Store = findStore('DeveloperExperiment');

	if (!Store) {
		Logger.error('Failed to find DeveloperExperimentStore.');

		return;
	}

	if (!Object.isExtensible(Store)) {
		Logger.warn('DeveloperExperimentStore is frozen, so staff mode cannot be applied.');

		return;
	}

	Patcher.instead(Store, 'initialize', ({ this: self }) => {
		self.waitFor(Users, Guilds);

		Object.defineProperties(self, {
			isDeveloper: {
				configurable: false,
				get: () => getSetting('staff-mode'),
				set: () => {},
			},
		});
	});

	unsubscribe = storage.addListener(
		(payload) => isSettingChange(payload, 'staff-mode'),
		() => Store.emitChange(),
	);
}

/** Stops following the `staff-mode` setting and restores the developer experiment store. */
export function stop() {
	unsubscribe?.();
	unsubscribe = null;

	Patcher.unpatchAll();
}

export default { start, stop };
