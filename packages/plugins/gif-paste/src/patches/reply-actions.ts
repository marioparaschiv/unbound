import type { KeptReplies } from '~/kept-replies';
import { Patcher, ReplyActions } from '~/modules';

/**
 * @description Skips clearing a pending reply that `keptReplies` marked during a GIF paste.
 * @param keptReplies The channels whose next reply clear is skipped.
 * @returns A function that removes the patch.
 */
export function patchReplyActions(keptReplies: KeptReplies): () => void {
	return Patcher.instead(ReplyActions, 'deletePendingReply', ({ args, original, this: self }) => {
		if (keptReplies.release(args[0])) return;

		return original.apply(self, args);
	});
}
