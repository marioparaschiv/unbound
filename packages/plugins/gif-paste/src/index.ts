import { metro, patcher } from '@unbound-app/api';

type MessageActions = {
	sendMessage?: (...args: unknown[]) => unknown;
};

type ChatInput = {
	closeCustomKeyboard?: () => void;
	insertText?: (text: string) => void;
};

type ChatInputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => ChatInput | null;
};

type ReplyActions = {
	deletePendingReply?: (channelId: string) => void;
};

type ReplyStore = {
	getPendingReply?: (channelId: string) => unknown;
};

const pendingGifReplies = new Set<string>();
let unpatchSend: (() => void) | null = null;
let unpatchReply: (() => void) | null = null;

function isGifPickerSelection(
	args: unknown[],
): args is [string, { content: string }, ...unknown[]] {
	const [channelId, message, , metadata] = args;
	return (
		typeof channelId === 'string' &&
		!!message &&
		typeof message === 'object' &&
		typeof (message as { content?: unknown }).content === 'string' &&
		!!metadata &&
		typeof metadata === 'object' &&
		(metadata as { location?: unknown }).location === 'gif_reply'
	);
}

function start(): void {
	const messages = metro.findByProps('sendMessage', 'editMessage') as MessageActions | null;
	if (typeof messages?.sendMessage !== 'function') return;
	const replies = metro.findByProps('deletePendingReply') as ReplyActions | null;
	const replyStore = metro.findByProps('getPendingReply') as ReplyStore | null;
	if (typeof replies?.deletePendingReply !== 'function') return;
	if (typeof replyStore?.getPendingReply !== 'function') return;

	unpatchReply = patcher.instead(replies, 'deletePendingReply', (ctx) => {
		const [channelId] = ctx.args;
		if (typeof channelId === 'string' && pendingGifReplies.delete(channelId)) return;
		return ctx.original.apply(ctx.this, ctx.args);
	});

	unpatchSend = patcher.instead(messages, 'sendMessage', (ctx) => {
		if (!isGifPickerSelection(ctx.args)) return ctx.original.apply(ctx.this, ctx.args);

		const [channelId, message] = ctx.args;
		const registry = metro.findByProps(
			'getBestActiveInputForChannelId',
		) as ChatInputRegistry | null;
		const input = registry?.getBestActiveInputForChannelId?.(channelId);
		if (typeof input?.insertText !== 'function') return ctx.original.apply(ctx.this, ctx.args);

		input.insertText(`${message.content} `);
		input.closeCustomKeyboard?.();
		if (replyStore.getPendingReply?.(channelId)) {
			pendingGifReplies.add(channelId);
			Promise.resolve().then(() => pendingGifReplies.delete(channelId));
		}
	});
}

function stop(): void {
	unpatchSend?.();
	unpatchReply?.();
	unpatchSend = null;
	unpatchReply = null;
	pendingGifReplies.clear();
}

export default { start, stop };
