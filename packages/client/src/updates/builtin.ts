import type { SectionEntry } from '~/settings/section';
import { notifyUpdates } from '~/updates/notify';
import { getSetting } from '~/settings/unbound';
import UpdatesPage from '~/ui/settings/updates';
import { Screens } from '~/core/constants';
import UpdatesStore from '~/updates/state';

let pending: ReturnType<typeof setTimeout> | undefined;

async function update() {
	const { check, applyAll } = UpdatesStore.getState();

	await check();

	if (getSetting('updater.auto')) {
		await applyAll();
	}

	// After applying, so the toast counts only the updates still waiting.
	notifyUpdates(UpdatesStore.getState().state, getSetting('updater.notify'));
}

/**
 * Checks for addon updates once after startup, applying them when `updater.auto` is on. A toast then says
 * when the loader is too old for the newest bundle, or with `updater.notify` on, what is left to update.
 */
export function start() {
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
