import { patcher } from '@unbound-app/api';

import type { KeptReplies } from '~/gif-paste/kept-replies';
import { ReplyActions } from '~/gif-paste/modules';

/**
 * @description Skips clearing a pending reply that `keptReplies` marked during a GIF paste.
 * @param keptReplies The channels whose next reply clear is skipped.
 */
export function patchReplyActions(keptReplies: KeptReplies): void {
	patcher.instead(ReplyActions, 'deletePendingReply', ({ args, original, this: self }) => {
		if (keptReplies.release(args[0])) return;

		return original.apply(self, args);
	});
}
