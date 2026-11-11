import { flux } from '@unbound-app/api';

import { MessageStore, UserStore } from '~/log/modules';

type CreatedMessage = {
	id?: string;
	channel_id?: string;
	nonce?: string;
	author?: { id?: string };
};

/**
 * @description Stops another user's message from replacing an earlier sent message through a reused nonce, which would hide that message without a deletion to log.
 * The Addon scope removes the interceptor on `MESSAGE_CREATE` when the plugin stops.
 * @returns A function with nothing to undo; the Addon scope removes what it added.
 */
export function startNonces(): () => void {
	flux.interceptAction('MESSAGE_CREATE', (action) => {
		const message = (action as { message?: CreatedMessage }).message;

		if (!message?.nonce || !message.channel_id) return false;

		if (message.author?.id === UserStore.getCurrentUser?.()?.id) return false;

		const previous = MessageStore.getMessage(message.channel_id, message.nonce);

		if (previous?.state === 'SENT' && previous.id !== message.id) delete message.nonce;

		return false;
	});

	return () => {};
}
