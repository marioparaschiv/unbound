import { flux } from '@unbound-app/api';

import type { MessageLog } from '~/log';
import { MessageStore } from '~/discord/modules';

/**
 * @description Has the chat draw a message's row again, so a change to its log shows without reopening the channel.
 * @param log The message log.
 * @param channelId The message's channel.
 * @param messageId The message.
 */
export function redrawMessage(log: MessageLog, channelId: string, messageId: string): void {
	log.requestRender(messageId);
	setTimeout(() => {
		const message = MessageStore.getMessage(channelId, messageId);

		if (!message) return;

		void flux.dispatch({
			type: 'MESSAGE_UPDATE',
			message: {
				id: messageId,
				channel_id: channelId,
				content: message.content,
				author: message.author,
			},
		});
	}, 0);
}

export default redrawMessage;
