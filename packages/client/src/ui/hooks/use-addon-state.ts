import { ManagerKind, ManagerNames } from '~/lib/constants';
import { useSettingsStore } from '~/api/storage';
import { getManager } from '~/managers/utils';

/** A single addon's live state slice, so one toggle re-renders only that card's control. */
export type AddonState = {
	enabled: boolean;
	failed: boolean;
};

/**
 * @description Reads one addon's enabled/failed slice, re-rendering only this addon when it changes.
 * Plugins/Themes read the `states` map; Icons are single-select and read the applied pack.
 * @param kind The addon's manager kind.
 * @param id The addon id.
 * @returns The addon's current enabled and failed flags.
 */
function useAddonState(
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons,
	id: string,
): AddonState {
	const manager = getManager(kind);
	const storeName = ManagerNames[kind].toLowerCase();

	const settings = useSettingsStore(
		storeName,
		({ key }) => key === 'states' || key === 'applied',
	);

	const enabled =
		kind === ManagerKind.Icons
			? settings.get('applied', { manifest: { id: 'default' } }).manifest.id === id
			: Boolean(settings.get<Record<string, boolean>>('states', {})[id]);

	const failed = manager.errors.has(id);

	return { enabled, failed };
}

export default useAddonState;
