import { metro } from '@unbound-app/api';

import { scheduleLayoutRefresh } from '~/native/collections';
import { reloadReactors } from '~/native/reaction-surfaces';
import type { Session } from '~/native/session';
import { REACTION_ACTIONS } from '~/constants';

type ReactionChange = {
	channelId?: string;
	channel_id?: string;
	messageId?: string;
	message_id?: string;
};

/**
 * @description Refetches a message's reactors and reflows its pills whenever its reactions change, for every `MESSAGE_REACTION_*` action.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */
export function subscribeReactionChanges(session: Session): () => void {
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

	for (const action of REACTION_ACTIONS) {
		metro.common.Dispatcher.subscribe(action, onReactionChange);
	}

	return () => {
		for (const action of REACTION_ACTIONS) {
			metro.common.Dispatcher.unsubscribe(action, onReactionChange);
		}
	};
}
