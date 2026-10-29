import { MessageStore, SelectedChannelStore, UserStore } from '~/modules';

/**
 * @description Tells whether a message was sent by the signed-in user.
 * @param messageId The message's id.
 * @param channelId The message's channel, or the selected channel when it is not known.
 * @returns `true` for the user's own messages, `false` otherwise or when the message is not loaded.
 */
export function isOwnMessage(messageId: string | undefined, channelId?: string): boolean {
	const channel = channelId ?? SelectedChannelStore.getChannelId?.();
	const message =
		messageId && channel ? MessageStore.getMessage?.(channel, messageId) : undefined;
	const self = UserStore.getCurrentUser?.()?.id;

	return Boolean(self && message?.author?.id === self);
}

export default { isOwnMessage };
