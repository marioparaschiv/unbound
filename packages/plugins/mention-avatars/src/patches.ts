import { onMessageRow } from '@unbound-plugins/shared/metro/message-rows';

import type { MentionIndex } from '~/lib/mention-index';
import type { Message } from '~/lib/resolve-mentions';

/**
 * @description Indexes each message's mentions as Discord builds its chat row, by patching `generateMessageRowData`.
 * @param index The mention index to fill.
 */
export function patchMessageRows(index: MentionIndex): void {
	onMessageRow<Message>({ after: ({ message }) => index.add(message) });
}
