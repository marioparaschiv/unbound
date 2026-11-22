import { isPreResetVersion } from '@unbound-app/contracts/client-version-reset';
import { CORE_BUCKET } from '@unbound-app/types/settings';
import { AppState } from 'react-native';

import { isStagedUpdateImportant, recordRunningBundle } from '~/updates/important-update';
import { notifyClientUpdated, notifyStagedBundle, notifyUpdates } from '~/updates/notify';
import { CLIENT_VERSION, Screens } from '~/core/constants';
import { hasStagedBundle } from '~/native/unbound-native';
import type { SectionEntry } from '~/settings/section';
import { getBucket, persist } from '~/storage/api';
import { compareVersions } from '~/core/versions';
import { getSetting } from '~/settings/unbound';
import UpdatesStore from '~/updates/state';

// The loader downloads the next bundle in the background, usually within seconds of launch.
const STAGED_CHECK_DELAY = 20_000;

// Device-local, as Sync would carry another device's version over and re-announce this update.
const storage = getBucket('unbound::updater');
const LEGACY_LAST_CLIENT_VERSION = 'updater.lastClientVersion';

let stagedCheck: ReturnType<typeof setTimeout> | undefined;
let appState: ReturnType<typeof AppState.addEventListener> | undefined;
let unsubscribe: (() => void) | undefined;
let stagedAnnounced = false;
let stagedChecking = false;

// A staged bundle applies on the next launch anyway; only an important one is worth interrupting for.
// A quiet answer is asked again on the next check, as a later build staged over it may be important.
async function announceStagedBundle() {
	if (stagedAnnounced || stagedChecking) return;

	if (!getSetting('updater.notify.client') || !hasStagedBundle()) return;

	stagedChecking = true;

	try {
		if (await isStagedUpdateImportant()) {
			stagedAnnounced = true;
			notifyStagedBundle();
		}
	} finally {
		stagedChecking = false;
	}
}

async function update() {
	const { check, applyAll } = UpdatesStore.getState();

	await check();

	if (getSetting('updater.auto.addons')) {
		await applyAll();
	}

	// After applying, so the toast counts only the updates still waiting.
	notifyUpdates(UpdatesStore.getState().state, {
		loader: getSetting('updater.notify.loader'),
		addons: getSetting('updater.notify.addons'),
	});
}

function announceClient() {
	const previous = storage.get('lastClientVersion', '');

	getBucket(CORE_BUCKET).remove(LEGACY_LAST_CLIENT_VERSION);

	// A pre-reset version (3.x) is older than every version after the reset, though it compares higher.
	const reset = isPreResetVersion(previous) && !isPreResetVersion(CLIENT_VERSION);

	// Keeps the newest version seen: the loader runs the previous bundle again when it discards an update that
	// closed before it was healthy, and the retried update must not announce itself a second time.
	if (previous && !reset && compareVersions(CLIENT_VERSION, previous) <= 0) return;

	if (getSetting('updater.notify.client')) {
		notifyClientUpdated(previous, CLIENT_VERSION);
	}

	storage.set('lastClientVersion', CLIENT_VERSION);
	// Saved now, not on the debounce: an older iOS loader reloads settings.json when the updater writes it at
	// launch, dropping changes not yet saved, and the next launch would announce this version again.
	void persist();
}

/** Toasts a newly updated client, and offers a restart once the loader stages the next bundle. */
export function start() {
	recordRunningBundle();
	announceClient();

	// A check from the updates page can stage the next bundle well after launch.
	unsubscribe = UpdatesStore.subscribe(({ state }) => {
		if (state.status === 'ready' && state.client === 'staged') {
			void announceStagedBundle();
		}
	});

	stagedCheck = setTimeout(() => void announceStagedBundle(), STAGED_CHECK_DELAY);
	appState = AppState.addEventListener('change', (state) => {
		if (state !== 'active') return;

		void announceStagedBundle();
		// Returning to the foreground can start a loader update check, which takes a moment to download.
		clearTimeout(stagedCheck);
		stagedCheck = setTimeout(() => void announceStagedBundle(), STAGED_CHECK_DELAY);
	});
}

/**
 * Checks for updates once the addons have loaded: applies addon updates with `updater.auto.addons` on, and toasts
 * a too-old loader and, per `updater.notify.*`, what is left.
 */
export function afterAddons() {
	void update();
}

/** Cancels the staged bundle check. */
export function stop() {
	unsubscribe?.();
	unsubscribe = undefined;
	clearTimeout(stagedCheck);
	appState?.remove();
	appState = undefined;
}

export const updatesSection: SectionEntry = {
	key: Screens.Updates,
	titleKey: 'UNBOUND_UPDATES',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/updates').default,
	icon: 'DownloadIcon',
};

export default { start, afterAddons, stop, updatesSection };
