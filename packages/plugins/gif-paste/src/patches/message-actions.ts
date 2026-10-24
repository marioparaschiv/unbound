import { ChatInputRegistry, MessageActions, PendingReplyStore, Patcher } from '~/modules';
import type { KeptReplies } from '~/kept-replies';

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
 * @description Pastes a GIF picker selection into the chat input instead of sending it.
 * @param keptReplies Marks the channel's pending reply so the picker's clear right after does not drop it.
 * @returns A function that removes the patch.
 */
export function patchMessageActions(keptReplies: KeptReplies): () => void {
	return Patcher.instead(MessageActions, 'sendMessage', ({ args, original, this: self }) => {
		if (!isGifSelection(args)) return original.apply(self, args);

		const [channelId, message] = args;
		const input: ChatInput | null | undefined =
			ChatInputRegistry.getBestActiveInputForChannelId?.(channelId);

		if (typeof input?.insertText !== 'function') return original.apply(self, args);

		input.insertText(`${message.content} `);
		input.closeCustomKeyboard?.();

		if (PendingReplyStore.getPendingReply(channelId)) keptReplies.keep(channelId);
	});
}
