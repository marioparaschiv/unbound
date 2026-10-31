import { flux } from '@unbound-app/api';

import { scheduleLayoutRefresh } from '~/ios/collections';
import { reloadReactors } from '~/ios/reaction-surfaces';
import type { Session } from '~/ios/session';
import { REACTION_ACTIONS } from '~/constants';
import type { ReactionChange } from '~/types';

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

	const removers = REACTION_ACTIONS.map((action) => flux.onAction(action, onReactionChange));

	return () => {
		for (const remove of removers) remove();
	};
}
