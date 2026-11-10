import { useEffect } from 'react';

import type { RecordChange, RecordKey } from '~/addons/records';
import type { UpdatableKind } from '~/addons/manager-of';
import useForceUpdate from '~/ui/hooks/use-force-update';
import { Manager } from '~/addons/manager';

/**
 * @description Re-renders the calling component when one of its manager's records changes.
 * @param kind The addon kind whose manager to watch.
 * @param keys The records to watch, such as `states` or `held`.
 */
function useRecordChanges(kind: UpdatableKind, keys: RecordKey[]): void {
	const forceUpdate = useForceUpdate();
	const watched = keys.join();

	useEffect(() => onRecordChange(kind, keys, forceUpdate), [kind, watched]);
}

/**
 * @description Calls a listener when one of a manager's records changes.
 * @param kind The addon kind whose manager to watch.
 * @param keys The records to watch.
 * @param listener Runs after each matching change.
 * @returns A function that removes the listener.
 */
export function onRecordChange(
	kind: UpdatableKind,
	keys: RecordKey[],
	listener: () => void,
): () => void {
	const manager = Manager.for(kind);
	function handler({ key }: RecordChange) {
		if (keys.includes(key)) {
			listener();
		}
	}

	manager.on('record-changed', handler);

	return () => void manager.off('record-changed', handler);
}

export default useRecordChanges;
