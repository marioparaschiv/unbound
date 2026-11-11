import { flux } from '@unbound-app/api';

const REBIND_ALL_MS = 1500;

const MessageStore = flux.getStore('Message');

type StoredMessage = {
	content: string;
	author: unknown;
};

type MessageLookup = {
	getMessage?: (channelId: string, messageId: string) => StoredMessage | undefined;
};

/**
 * @description Redraws the chat rows, so they pick up new branding or a switched embed.
 */
export function redrawMessages() {
	MessageStore.emitChange?.();
}

/**
 * @description Has the chat build one message's row again, so new branding shows without waiting for the next redraw.
 * @param channelId The message's channel.
 * @param messageId The message.
 */
export function redrawMessage(channelId: string, messageId: string) {
	const message = (MessageStore as unknown as MessageLookup).getMessage?.(channelId, messageId);

	if (!message) return;

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

/**
 * @description Remembers which messages wait for a video's branding, so only their rows are redrawn when it arrives.
 * @returns `track` records a message waiting on videos, `resolve` redraws the messages waiting on a video, `rebindMessage` redraws one message, `rebindAll` redraws every row, `takeRebind` tells whether a row must be bound again, `clear` forgets them all.
 */
export function createPendingRows() {
	const waiting = new Map<string, Map<string, string>>();
	const rebinds = new Set<string>();
	let rebindAllUntil = 0;

	function rebindMessage(channelId: string, messageId: string) {
		rebinds.add(messageId);
		redrawMessage(channelId, messageId);
	}

	function rebindAll() {
		rebindAllUntil = Date.now() + REBIND_ALL_MS;
		redrawMessages();
	}

	function track(videoIds: readonly string[], channelId: unknown, messageId: unknown) {
		if (typeof channelId !== 'string' || typeof messageId !== 'string') return;

		for (const videoId of videoIds) {
			const messages = waiting.get(videoId) ?? new Map<string, string>();

			messages.set(messageId, channelId);
			waiting.set(videoId, messages);
		}
	}

	function resolve(videoId: string) {
		const messages = waiting.get(videoId);

		waiting.delete(videoId);

		if (!messages) return rebindAll();

		setTimeout(() => {
			for (const [messageId, channelId] of messages) rebindMessage(channelId, messageId);
		}, 0);
	}

	function takeRebind(messageId: string): boolean {
		return rebinds.delete(messageId) || Date.now() < rebindAllUntil;
	}

	function clear() {
		waiting.clear();
		rebinds.clear();
	}

	return { track, resolve, rebindMessage, rebindAll, takeRebind, clear };
}

export type PendingRows = ReturnType<typeof createPendingRows>;
