import { getSetting } from '~/settings/unbound';
import UpdatesStore from '~/updates/state';

/**
 * @description Checks for updates and, with `updater.auto.addons` on, applies the addon updates, without toasts, as
 * nobody sees them in the background.
 */
export async function updateInBackground(): Promise<void> {
	const { check, applyAll } = UpdatesStore.getState();

	await check();

	if (getSetting('updater.auto.addons')) {
		await applyAll();
	}
}

export default { updateInBackground };
