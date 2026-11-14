import { flux } from '@unbound-app/api';

type StoredMessage = { content: string; author: unknown };

type MessageStore = { getMessage(channelId: string, messageId: string): StoredMessage | undefined };

const pending = new Set<string>();

/**
 * @description Tells whether a row was asked to redraw, and forgets the request.
 * @param messageId The message.
 * @returns Whether the row must redraw although Discord sees no change.
 */
export function takeRedraw(messageId: string): boolean {
	return pending.delete(messageId);
}

/**
 * @description Has the chat build a message's row again with its unchanged content, so a local edit shows at once.
 * @param channelId The message's channel.
 * @param messageId The message.
 */
export function redrawMessage(channelId: string, messageId: string): void {
	const message = (flux.getStore('Message') as unknown as MessageStore).getMessage(
		channelId,
		messageId,
	);

	if (!message) return;

	pending.add(messageId);
	void flux.dispatch({
		type: 'MESSAGE_UPDATE',
		message: {
			id: messageId,
			channel_id: channelId,
			content: message.content,
			author: message.author,
		},
	} as Parameters<typeof flux.dispatch>[0]);
}
