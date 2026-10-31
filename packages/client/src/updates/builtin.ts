import type { SectionEntry } from '~/settings/section';
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
}

/** Checks for addon updates once after startup, applying them when `updater.auto` is on. */
export function start() {
	// Built-ins start before the addon managers load their entities.
	pending = setTimeout(() => void update());
}

/** Cancels an update check that has not started yet. */
export function stop() {
	clearTimeout(pending);
}

/** The Updates page. */
export const updatesSection: SectionEntry = {
	key: Screens.Updates,
	title: 'UNBOUND_UPDATES',
	component: UpdatesPage,
	icon: 'DownloadIcon',
};

export default { start, stop, updatesSection };
