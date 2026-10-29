import { createLogger } from '@unbound-app/logger';

import { filters, onModuleLoaded } from '~/api/metro';
import { Guilds, Users } from '~/api/metro/stores';
import { createPatcher } from '~/api/patcher';
import storage from '~/api/storage';

const Patcher = createPatcher('unbound::staff-mode');
const Logger = createLogger('StaffMode');
const Settings = storage.getStore('unbound');

let stopWaiting: (() => void) | null = null;
let unsubscribe: (() => void) | null = null;

/** Makes the developer experiment store report staff status from the `staff-mode` setting. */
export function start() {
	// The patch lands as the store's module loads, before Flux initializes the store.
	stopWaiting = onModuleLoaded(filters.byStore('DeveloperExperiment'), patchStore);
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
				get: () => Settings.get('staff-mode', false),
				set: () => {},
			},
		});
	});

	unsubscribe = storage.addListener(
		(payload) => payload.store === 'unbound' && payload.key === 'staff-mode',
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
