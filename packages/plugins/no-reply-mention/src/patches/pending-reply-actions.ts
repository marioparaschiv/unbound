import { PendingReplyActions, Patcher, settings } from '~/modules';
import { shouldMention } from '~/user-list';

/**
 * @description Starts every reply with its mention off, unless the replied-to author is on the exception list.
 * @returns A function that removes the patch.
 */
export function patchPendingReplyActions(): () => void {
	return Patcher.before(PendingReplyActions, 'createPendingReply', ({ args: [reply] }) => {
		if (!reply) return;

		reply.shouldMention = shouldMention(
			reply.message?.author?.id,
			settings.get('userList', ''),
			settings.get('shouldPingListed', false),
		);
	});
}
