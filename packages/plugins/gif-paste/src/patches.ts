import { flux, metro, patcher } from '@unbound-app/api';

import { keptReplies } from '~/lib/kept-replies';

type ChatInput = {
	insertText?: (text: string) => void;
	closeCustomKeyboard?: () => void;
};

type GifSelection = [channelId: string, message: { content: string }, ...rest: unknown[]];

type SelectionMetadata = { location?: string } | undefined;

function isGifSelection(args: unknown[]): args is GifSelection {
	const [channelId, message, , metadata] = args;

	return (
		typeof channelId === 'string' &&
		typeof (message as GifSelection[1] | undefined)?.content === 'string' &&
		(metadata as SelectionMetadata)?.location === 'gif_reply'
	);
}

/**
 * @description Skips clearing a pending reply that `keptReplies` marked during a GIF paste, by patching
 * `deletePendingReply` on Discord's `ReplyActions`.
 */
export function patchReplyActions(): void {
	const ReplyActions = metro.findByProps('deletePendingReply');

	if (!ReplyActions) {
		logger.warn('Kept replies skipped: Discord moved ReplyActions.');

		return;
	}

	patcher.instead(ReplyActions, 'deletePendingReply', ({ args, original, this: self }) => {
		if (keptReplies.isKept(args[0])) return;

		return original.apply(self, args);
	});
}

/**
 * @description Drops a `DELETE_PENDING_REPLY` for a channel whose reply a GIF paste just kept, for clears that skip
 * `ReplyActions`.
 * @returns A function that lets them through again.
 */
export function keepRepliesFromDirectClears(): () => void {
	return flux.interceptAction('DELETE_PENDING_REPLY', (action) =>
		keptReplies.isKept((action as { channelId?: string }).channelId),
	);
}

/**
 * @description Pastes a GIF picker selection into the chat input instead of sending it, by patching `sendMessage` on
 * Discord's `MessageActions`; marks the channel's pending reply so the picker's clear right after does not drop it.
 */
export function patchMessageActions(): void {
	const MessageActions = metro.api.Messages;
	const PendingReplyStore = metro.findByProps('getPendingReply');
	const ChatInputRegistry = metro.findByProps('getBestActiveInputForChannelId');

	if (!MessageActions || !PendingReplyStore) {
		logger.warn('GIF paste skipped: Discord moved MessageActions or PendingReplyStore.');

		return;
	}

	patcher.instead(MessageActions, 'sendMessage', ({ args, original, this: self }) => {
		if (!isGifSelection(args)) {
			if (typeof args[0] === 'string') keptReplies.forget(args[0]);

			return original.apply(self, args);
		}

		const [channelId, message] = args;
		const input: ChatInput | null | undefined =
			ChatInputRegistry?.getBestActiveInputForChannelId?.(channelId);

		if (typeof input?.insertText !== 'function') return original.apply(self, args);

		if (PendingReplyStore.getPendingReply(channelId)) keptReplies.keep(channelId);

		input.insertText(`${message.content} `);
		input.closeCustomKeyboard?.();
	});
}
