import useRecordChanges from '~/ui/hooks/use-record-changes';
import type { UpdatableKind } from '~/addons/manager-of';
import { Manager } from '~/addons/manager';

/** A single addon's live state slice, so one toggle re-renders only that card's control. */
export type AddonState = {
	enabled: boolean;
	failed: boolean;
};

/**
 * @description Reads one addon's enabled/failed slice, re-rendering when its manager's enabled states change.
 * The manager decides what enabled means: plugins read their states, themes and icons the applied one.
 * @param kind The addon's manager kind.
 * @param id The addon id.
 * @returns The addon's current enabled and failed flags.
 */
function useAddonState(kind: UpdatableKind, id: string): AddonState {
	const manager = Manager.for(kind);

	useRecordChanges(kind, ['states', 'applied']);

	return { enabled: manager.isEnabled(id), failed: manager.errors.has(id) };
}

export default useAddonState;
