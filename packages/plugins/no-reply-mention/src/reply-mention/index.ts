import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { PendingReplyActions } from '~/reply-mention/modules';
import { shouldMention } from '~/reply-mention/user-list';

/**
 * @description Starts every reply with its mention off, unless the replied-to author is on the exception list.
 * Patches `createPendingReply` on Discord's pending reply actions module. The Addon scope removes the patch when the plugin stops.
 */
export function startReplyMention(): void {
	if (!ensureModules({ PendingReplyActions })) return;

	patcher.before(PendingReplyActions, 'createPendingReply', ({ args: [reply] }) => {
		if (!reply) return;

		reply.shouldMention = shouldMention(
			reply.message?.author?.id,
			settings.userList,
			settings.shouldPingListed,
		);
	});
}
