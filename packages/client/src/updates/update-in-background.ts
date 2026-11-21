import { getSetting } from '~/settings/unbound';
import UpdatesStore from '~/updates/state';

/**
 * @description Checks for updates and, with `updater.auto.addons` on, applies the addon updates, without toasts, as
 * nobody sees them in the background.
 * @returns Whether the check found an addon or client update.
 */
export async function updateInBackground(): Promise<boolean> {
	const { check, applyAll } = UpdatesStore.getState();

	await check();

	const { state } = UpdatesStore.getState();
	const found =
		state.status === 'ready' && (state.updates.length > 0 || state.client !== 'current');

	if (getSetting('updater.auto.addons')) {
		await applyAll();
	}

	return found;
}

export default { updateInBackground };
