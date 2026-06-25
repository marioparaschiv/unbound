import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';

import { Guilds, Users } from '~/api/metro/stores';
import { findStore } from '~/api/metro';
import storage from '~/api/storage';

const Patcher = createPatcher('unbound::staff-mode');
const Logger = createLogger('StaffMode');
const Settings = storage.getStore('unbound');

let unsubscribe: (() => void) | null = null;

export function start() {
	const Store = findStore('DeveloperExperiment');
	if (!Store) return Logger.error('Failed to find DeveloperExperimentStore.');

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

export function stop() {
	unsubscribe?.();
	unsubscribe = null;

	Patcher.unpatchAll();
}

export default { start, stop };
