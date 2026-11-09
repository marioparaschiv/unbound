import type { SectionEntry } from '~/settings/section';
import { notifyClientUpdated, notifyUpdates } from '~/updates/notify';
import { getSetting, setSetting } from '~/settings/unbound';
import UpdatesPage from '~/ui/settings/updates';
import { CLIENT_VERSION, Screens } from '~/core/constants';
import UpdatesStore from '~/updates/state';

let pending: ReturnType<typeof setTimeout> | undefined;

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
	const previous = getSetting('updater.lastClientVersion');

	if (previous === CLIENT_VERSION) return;

	if (getSetting('updater.notify.client')) {
		notifyClientUpdated(previous, CLIENT_VERSION);
	}

	setSetting('updater.lastClientVersion', CLIENT_VERSION);
}

/**
 * Toasts a newly updated client, then checks for updates once after startup: applies addon updates with
 * `updater.auto.addons` on, and toasts a too-old loader and, per `updater.notify.*`, what is left.
 */
export function start() {
	announceClient();

	// Built-ins start before the addon managers load their entities.
	pending = setTimeout(() => void update());
}

/** Cancels an update check that has not started yet. */
export function stop() {
	clearTimeout(pending);
}

export const updatesSection: SectionEntry = {
	key: Screens.Updates,
	titleKey: 'UNBOUND_UPDATES',
	component: UpdatesPage,
	icon: 'DownloadIcon',
};

export default { start, stop, updatesSection };
