import { SYNC_LOCAL_STORE_PREFIX } from '@unbound-app/contracts/sync';
import debounce from '@unbound-app/utils/debounce';

import { getMode, isApplying, isEnabled, sync } from '~/managers/cloud-sync';
import storage from '~/api/storage';

/** How long local changes settle before they are synced. */
const SYNC_DELAY_MS = 5000;

let unsubscribe: (() => void) | null = null;
let pending: ReturnType<typeof setTimeout> | undefined;
let stopped = false;

// A download-only device takes the cloud's setup at launch and on demand; syncing after a local
// change would quietly revert it.
const scheduleSync = debounce(() => {
	if (stopped || !isEnabled() || getMode() === 'download') return;

	void sync();
}, SYNC_DELAY_MS);

/** Syncs once addons have loaded, then after local changes settle. */
export function start() {
	stopped = false;

	// Built-ins start before the addon managers load their entities.
	pending = setTimeout(() => {
		if (isEnabled()) {
			void sync();
		}
	});

	// Install sources, enabled and applied state all live in settings, so one listener sees every change.
	unsubscribe = storage.addListener(
		(payload) => !payload.store.startsWith(SYNC_LOCAL_STORE_PREFIX) && !isApplying(),
		scheduleSync,
	);
}

/** Stops syncing on local changes and cancels a pending sync. */
export function stop() {
	stopped = true;
	clearTimeout(pending);
	unsubscribe?.();
	unsubscribe = null;
}

export default { start, stop };
