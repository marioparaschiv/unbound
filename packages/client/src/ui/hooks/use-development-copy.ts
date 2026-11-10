import useRecordChanges from '~/ui/hooks/use-record-changes';
import type { UpdatableKind } from '~/addons/manager-of';
import { Manager } from '~/addons/manager';

/**
 * @description Reads whether an addon is a development copy, re-rendering when its manager's development markers change.
 * @param kind The addon's kind.
 * @param id The addon id.
 * @returns Whether the addon is a development copy.
 */
function useDevelopmentCopy(kind: UpdatableKind, id: string): boolean {
	useRecordChanges(kind, ['development']);

	return Manager.for(kind).isDevelopmentCopy(id);
}

export default useDevelopmentCopy;
