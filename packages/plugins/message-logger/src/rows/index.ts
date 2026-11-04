import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';

import { patchChatManager } from '~/rows/change-type';
import { patchRowManager } from '~/rows/row-manager';
import type { MessageLog } from '~/log';

/**
 * @description Shows each row's log: deleted messages in red with a deleted marker, earlier versions above edited text, and deleted attachments marked.
 * Patches `generate` on Discord's `RowManager` and `determineChangeType` on its `ChatManager`, so a change to a log redraws the row.
 * The Addon scope removes both patches when the plugin stops.
 * @param log The message log.
 */
export function startRows(log: MessageLog): void {
	patchRowManager(log);
	patchChatManager(log);

	recordApplied(2);
}
