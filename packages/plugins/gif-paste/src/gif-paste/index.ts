import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { MessageActions, PendingReplyStore, ReplyActions } from '~/gif-paste/modules';
import { patchMessageActions } from '~/gif-paste/message-actions';
import { patchReplyActions } from '~/gif-paste/reply-actions';
import { createKeptReplies } from '~/gif-paste/kept-replies';

/**
 * @description Pastes GIF picker selections into the composer instead of sending them.
 * Patches `sendMessage` on `MessageActions` and `deletePendingReply` on `ReplyActions`, and reads
 * `PendingReplyStore` and `ChatInputRegistry`. The Addon scope removes both patches when the plugin stops.
 */
export function startGifPaste(): void {
	if (!ensureModules('GIF Paste', { MessageActions, ReplyActions, PendingReplyStore })) return;

	const keptReplies = createKeptReplies();

	patchReplyActions(keptReplies);
	patchMessageActions(keptReplies);

	recordApplied(2);
}
