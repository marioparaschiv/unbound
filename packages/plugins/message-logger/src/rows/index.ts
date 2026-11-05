import { patchChatManager } from '~/rows/change-type';
import { patchRowManager } from '~/rows/row-manager';
import type { MessageLog } from '~/log';

/**
 * @description Shows each row's log: deleted messages in red with a deleted marker, earlier versions above edited text, and deleted attachments marked.
 * Patches `generate` on Discord's `RowManager` and `determineChangeType` on its `ChatManager`, so a change to a log redraws the row.
 * @param log The message log.
 * @returns A function that removes both patches, for `stop` to call before it makes Discord draw the rows again.
 */
export function startRows(log: MessageLog): () => void {
	const unpatchRows = patchRowManager(log);
	const unpatchChanges = patchChatManager(log);

	return () => {
		unpatchRows();
		unpatchChanges();
	};
}
