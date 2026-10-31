import UpdatesStore, { findLoaderUpdate } from '~/updates/state';

/**
 * @description Checks every installed addon and the loader for updates. Concurrent calls share one check.
 * @returns A promise that settles once the check finished.
 */
export function check(): Promise<void> {
	return UpdatesStore.getState().check();
}

/**
 * @description Applies the pending update of one addon found by the last {@link check}.
 * @param id The addon's id.
 * @returns Whether the addon now runs the new version.
 */
export function apply(id: string): Promise<boolean> {
	return UpdatesStore.getState().apply(id);
}

/**
 * @description Applies every pending update except newer versions of addons held on a version.
 * @returns A promise that settles once every update was applied or failed.
 */
export function applyAll(): Promise<void> {
	return UpdatesStore.getState().applyAll();
}

/**
 * @description Asks the update server whether a newer loader is available for this device.
 * @returns The newer loader's version, or `null` when there is none or the check failed.
 */
export async function checkLoader(): Promise<string | null> {
	const update = await findLoaderUpdate();

	return update?.version ?? null;
}
