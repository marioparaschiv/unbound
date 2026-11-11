import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { shouldMention } from '~/lib/user-list';

/**
 * @description Starts every reply with its mention off, unless the replied-to author is on the exception list.
 * Patches `createPendingReply` on Discord's pending reply actions module.
 */
export function patchPendingReplyActions(): void {
	const PendingReplyActions = metro.findByProps('createPendingReply');

	if (!PendingReplyActions) {
		logger.warn('Reply mention skipped: Discord moved PendingReplyActions.');

		return;
	}

	patcher.before(PendingReplyActions, 'createPendingReply', ({ args: [reply] }) => {
		if (!reply) return;

		reply.shouldMention = shouldMention(
			reply.message?.author?.id,
			settings.userList,
			settings.shouldPingListed,
		);
	});
}
