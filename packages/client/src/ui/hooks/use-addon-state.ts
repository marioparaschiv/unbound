import { useSettingsStore } from '~/api/storage';
import { Manager } from '~/managers/base';

/** A single addon's live state slice, so one toggle re-renders only that card's control. */
export type AddonState = {
	enabled: boolean;
	failed: boolean;
};

/**
 * @description Reads one addon's enabled/failed slice, re-rendering only this addon when it changes.
 * The manager decides what enabled means: plugins and themes read their states, icons the applied pack.
 * @param kind The addon's manager kind.
 * @param id The addon id.
 * @returns The addon's current enabled and failed flags.
 */
function useAddonState(kind: 'plugin' | 'theme' | 'icon-pack', id: string): AddonState {
	const manager = Manager.for(kind);

	useSettingsStore(manager.bucket, ({ key }) => key === 'states' || key === 'applied');

	return { enabled: manager.isEnabled(id), failed: manager.errors.has(id) };
}

export default useAddonState;
