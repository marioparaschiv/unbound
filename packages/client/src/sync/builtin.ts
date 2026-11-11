import { SYNC_LOCAL_STORE_PREFIX } from '@unbound-app/contracts/sync-stores';
import debounce from '@unbound-app/utils/debounce';

import { connect, disconnect, getMode, isApplying, isEnabled, now } from '~/sync/api';
import { off as offAccount, on as onAccount } from '~/account/api';
import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';
import { onChange } from '~/storage/api';

/** How long local changes settle before they are synced. */
const SYNC_DELAY_MS = 5000;

let unsubscribe: (() => void) | null = null;
let stopped = false;

// A download-only device takes the cloud's setup at launch and on demand; syncing after a local
// change would quietly revert it.
const scheduleSync = debounce(() => {
	if (stopped || !isEnabled() || getMode() === 'download') return;

	void now();
}, SYNC_DELAY_MS);

function onSignedIn() {
	void connect();
}

/** Syncs after local changes settle, and follows the account signing in and out. */
export function start() {
	stopped = false;

	onAccount('signedIn', onSignedIn);
	onAccount('signedOut', disconnect);

	// Install sources, enabled and applied state all live in settings, so one listener sees every change.
	unsubscribe = onChange(
		(payload) => !payload.store.startsWith(SYNC_LOCAL_STORE_PREFIX) && !isApplying(),
		scheduleSync,
	);
}

/** Syncs once the addons have loaded, so the sync sees what is installed. */
export function afterAddons() {
	if (isEnabled()) {
		void now();
	}
}

/** Stops syncing on local changes and cancels a pending sync. */
export function stop() {
	stopped = true;
	offAccount('signedIn', onSignedIn);
	offAccount('signedOut', disconnect);
	unsubscribe?.();
	unsubscribe = null;
}

export const cloudSyncSection: SectionEntry = {
	key: Screens.Sync,
	titleKey: 'UNBOUND_CLOUD_SYNC',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/cloud-sync').default,
	// Listed on the General page, so the overview stays short.
	hidden: true,
};

export default { start, afterAddons, stop, cloudSyncSection };
