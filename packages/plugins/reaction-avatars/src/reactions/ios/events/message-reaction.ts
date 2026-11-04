import { flux } from '@unbound-app/api';

import { scheduleLayoutRefresh } from '~/reactions/ios/collections';
import { reloadReactors } from '~/reactions/ios/reaction-surfaces';
import type { Session } from '~/reactions/ios/session';
import { REACTION_ACTIONS } from '~/constants';
import type { ReactionChange } from '~/types';

/**
 * @description Refetches a message's reactors and reflows its pills whenever its reactions change, for every `MESSAGE_REACTION_*` action.
 * The Addon scope removes the listeners when the plugin stops.
 * @param session The running session.
 */
export function subscribeReactionChanges(session: Session): void {
	function onReactionChange(event: ReactionChange) {
		const messageId = event.messageId ?? event.message_id;

		if (!messageId) return;

		const channelId = event.channelId ?? event.channel_id;

		session.reactors.invalidateMessage(messageId, channelId);
		scheduleLayoutRefresh(session, messageId, channelId);
		reloadReactors(
			session,
			({ context }) =>
				context.messageId === messageId && (!channelId || context.channelId === channelId),
		);
	}

	for (const action of REACTION_ACTIONS) flux.onAction(action, onReactionChange);
}
