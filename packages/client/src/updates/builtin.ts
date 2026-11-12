import { CORE_BUCKET } from '@unbound-app/types/settings';
import { AppState } from 'react-native';

import { notifyClientUpdated, notifyStagedBundle, notifyUpdates } from '~/updates/notify';
import { CLIENT_VERSION, Screens } from '~/core/constants';
import { hasStagedBundle } from '~/native/unbound-native';
import type { SectionEntry } from '~/settings/section';
import { getSetting } from '~/settings/unbound';
import UpdatesStore from '~/updates/state';
import { getBucket } from '~/storage/api';

// The loader downloads the next bundle in the background, usually within seconds of launch.
const STAGED_CHECK_DELAY = 20_000;

// Device-local, as Sync would carry another device's version over and re-announce this update.
const storage = getBucket('unbound::updater');
const LEGACY_LAST_CLIENT_VERSION = 'updater.lastClientVersion';

let stagedCheck: ReturnType<typeof setTimeout> | undefined;
let appState: ReturnType<typeof AppState.addEventListener> | undefined;
let stagedAnnounced = false;

function announceStagedBundle() {
	if (stagedAnnounced || !getSetting('updater.notify.client') || !hasStagedBundle()) return;

	stagedAnnounced = true;
	notifyStagedBundle();
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

	if (previous === CLIENT_VERSION) return;

	if (getSetting('updater.notify.client')) {
		notifyClientUpdated(previous, CLIENT_VERSION);
	}

	storage.set('lastClientVersion', CLIENT_VERSION);
}

/** Toasts a newly updated client, and offers a restart once the loader stages the next bundle. */
export function start() {
	announceClient();

	stagedCheck = setTimeout(announceStagedBundle, STAGED_CHECK_DELAY);
	appState = AppState.addEventListener('change', (state) => {
		if (state !== 'active') return;

		announceStagedBundle();
		// Returning to the foreground can start a loader update check, which takes a moment to download.
		clearTimeout(stagedCheck);
		stagedCheck = setTimeout(announceStagedBundle, STAGED_CHECK_DELAY);
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
