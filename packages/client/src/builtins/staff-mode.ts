import { createLogger } from '@unbound-app/logger';

import { getSetting, isSettingChange } from '~/settings/unbound';
import { createPatcher } from '~/patcher/create-patcher';
import { Guilds, Users } from '~/metro/stores';
import { byFluxStore } from '~/metro/filters';
import { onModuleLoaded } from '~/metro/wait';
import { onChange } from '~/storage/api';

const Patcher = createPatcher('unbound::staff-mode');
const Logger = createLogger('StaffMode');

let stopWaiting: (() => void) | null = null;
let unsubscribe: (() => void) | null = null;

/** Makes the developer experiment store report staff status from the `staff-mode` setting. */
export function start() {
	// The patch lands as the store's module loads, before Flux initializes the store.
	stopWaiting = onModuleLoaded(byFluxStore('DeveloperExperiment'), patchStore);
}

function patchStore(Store: MetroExport) {
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

	unsubscribe = onChange(
		(payload) => isSettingChange(payload, 'staff-mode'),
		() => Store.emitChange(),
	);
}

/** Stops following the `staff-mode` setting and restores the developer experiment store. */
export function stop() {
	stopWaiting?.();
	stopWaiting = null;
	unsubscribe?.();
	unsubscribe = null;

	Patcher.unpatchAll();
}

export default { start, stop };
