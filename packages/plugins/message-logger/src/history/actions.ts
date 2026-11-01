import { flux } from '@unbound-app/api';

import type { AttachmentLike } from '~/edits/attachments';
import type { MessageLog } from '~/log';
import { MessageStore } from '~/discord/modules';
import { redrawMessage } from '~/rows/redraw';

export const CLEARING_FLAG = 'messageLoggerClearing';

function stripDeletedAttachments(log: MessageLog, channelId: string, messageId: string): void {
	const deletedIds = new Set(log.deletedAttachmentIds(messageId));

	if (!deletedIds.size) return;

	const message = MessageStore.getMessage(channelId, messageId);

	if (!message) return;

	const attachments: AttachmentLike[] = message.attachments ?? [];

	void flux.dispatch({
		type: 'MESSAGE_UPDATE',
		[CLEARING_FLAG]: true,
		message: {
			id: messageId,
			channel_id: channelId,
			content: message.content,
			author: message.author,
			attachments: attachments.filter((attachment) => !deletedIds.has(attachment.id)),
		},
	});
}

/**
 * @description Clears a message's log: a deleted message leaves the chat, and an edited one loses its earlier versions and deleted attachments.
 * @param log The message log.
 * @param channelId The message's channel.
 * @param messageId The message.
 */
export function clearMessageHistory(log: MessageLog, channelId: string, messageId: string): void {
	if (log.isDeleted(messageId)) {
		void flux.dispatch({ type: 'MESSAGE_DELETE', id: messageId, channelId });

		return;
	}

	stripDeletedAttachments(log, channelId, messageId);
	log.forgetEdits(messageId);
	redrawMessage(log, channelId, messageId);
}

/**
 * @description Clears the log of every loaded message in a channel.
 * @param log The message log.
 * @param channelId The channel.
 * @returns How many messages had a log.
 */
export function clearChannelLog(log: MessageLog, channelId: string): number {
	const messages = MessageStore.getMessages(channelId)?.toArray() ?? [];
	const logged = messages.filter((message) => log.hasHistory(message.id));

	for (const message of logged) clearMessageHistory(log, channelId, message.id);

	return logged.length;
}

/**
 * @description Tells whether any loaded message in a channel has a log.
 * @param log The message log.
 * @param channelId The channel.
 * @returns `true` when a message in the channel has a log.
 */
export function channelHasLog(log: MessageLog, channelId: string): boolean {
	const messages = MessageStore.getMessages(channelId)?.toArray() ?? [];

	return messages.some((message) => log.hasHistory(message.id));
}

/**
 * @description Removes the deleted messages and attachments the log kept, for `stop`, so none of them is left looking like a live message.
 * @param log The message log.
 */
export function purgeLog(log: MessageLog): void {
	for (const { channelId, messageId } of log.deletedMessages()) {
		log.forget(messageId);
		void flux.dispatch({ type: 'MESSAGE_DELETE', id: messageId, channelId });
	}

	for (const { channelId, messageId } of log.messagesWithDeletedAttachments()) {
		stripDeletedAttachments(log, channelId, messageId);
	}

	log.clear();
}
