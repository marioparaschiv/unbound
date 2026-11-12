import { MessageStore, SelectedChannelStore, UserStore } from '~/lib/modules';

/**
 * @description Finds who sent a message, as far as the loaded messages know.
 * @param messageId The message's id.
 * @param channelId The message's channel, or the selected channel when it is not known.
 * @returns The author's user id, or `undefined` when the message is not loaded.
 */
export function messageAuthor(
	messageId: string | undefined,
	channelId?: string,
): string | undefined {
	const channel = channelId ?? SelectedChannelStore.getChannelId?.();
	const message =
		messageId && channel ? MessageStore.getMessage?.(channel, messageId) : undefined;

	return message?.author?.id;
}

/**
 * @description Tells who sent a message, as far as the loaded messages know.
 * @param messageId The message's id.
 * @param channelId The message's channel, or the selected channel when it is not known.
 * @returns `true` for the user's own messages, `false` for others, `undefined` when the message is not loaded.
 */
export function messageOwnership(
	messageId: string | undefined,
	channelId?: string,
): boolean | undefined {
	const author = messageAuthor(messageId, channelId);
	const self = UserStore.getCurrentUser?.()?.id;

	if (!self || !author) return undefined;

	return author === self;
}

/**
 * @description Tells whether a message was sent by the signed-in user.
 * @param messageId The message's id.
 * @param channelId The message's channel, or the selected channel when it is not known.
 * @returns `true` for the user's own messages, `false` otherwise or when the message is not loaded.
 */
export function isOwnMessage(messageId: string | undefined, channelId?: string): boolean {
	return messageOwnership(messageId, channelId) ?? false;
}

export default { isOwnMessage, messageAuthor, messageOwnership };
