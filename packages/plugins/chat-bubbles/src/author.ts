import { MessageStore, SelectedChannelStore, UserStore } from '~/modules';

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
	const channel = channelId ?? SelectedChannelStore.getChannelId?.();
	const message =
		messageId && channel ? MessageStore.getMessage?.(channel, messageId) : undefined;
	const self = UserStore.getCurrentUser?.()?.id;

	if (!self || !message?.author) return undefined;

	return message.author.id === self;
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

export default { isOwnMessage, messageOwnership };
