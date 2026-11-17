import { flux, metro, patcher, plugins } from '@unbound-app/api';

type MessageReference = { channel_id?: string; message_id?: string } | null;

export type SendMessageOptions = {
	messageReference?: MessageReference;
	allowedMentions?: { replied_user?: boolean } | null;
};

export type SentMessage = { content: string };

export type SendArgs = [
	channelId: string,
	message: SentMessage,
	waitForChannelReady?: boolean,
	options?: SendMessageOptions,
];

export type SendGuard = (args: SendArgs) => boolean | Promise<boolean>;

type ChatInput = { insertText?: (text: string) => void };

type ChatInputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => ChatInput | null | undefined;
};

type ReplyActions = {
	createPendingReply?: (reply: {
		channel: unknown;
		message: unknown;
		shouldMention: boolean;
		showMentionToggle: boolean;
	}) => void;
};

type MessageStore = { getMessage(channelId: string, messageId: string): unknown };

type ChannelStore = { getChannel(channelId: string): unknown };

const GIF_PASTE = 'unbound.gif-paste';

function isPastedGif(args: unknown[]): boolean {
	const metadata = args[3] as { location?: string } | undefined;

	return metadata?.location === 'gif_reply' && plugins.isEnabled(GIF_PASTE);
}

function isSendArgs(args: unknown[]): args is SendArgs {
	return (
		typeof args[0] === 'string' &&
		typeof (args[1] as Partial<SentMessage> | null)?.content === 'string'
	);
}

function restoreReply(channelId: string, options: SendMessageOptions | undefined) {
	const reference = options?.messageReference;

	if (!reference?.message_id) return;

	const Messages = flux.getStore('Message') as unknown as MessageStore;
	const Channels = flux.getStore('Channel') as unknown as ChannelStore;
	const Replies = metro.findByProps('createPendingReply') as ReplyActions | undefined;
	const message = Messages.getMessage(reference.channel_id ?? channelId, reference.message_id);
	const channel = Channels.getChannel(channelId);

	if (!message || !channel) return;

	Replies?.createPendingReply?.({
		channel,
		message,
		shouldMention: options?.allowedMentions?.replied_user !== false,
		showMentionToggle: true,
	});
}

/**
 * @description Puts a send back where it came from: its text into the channel's chat input and, for a reply, the
 * reply bar, so a cancelled send loses nothing.
 * @param args The held send's arguments.
 */
export function restoreSend([channelId, message, , options]: SendArgs): void {
	const registry = metro.findByProps('getBestActiveInputForChannelId') as
		| ChatInputRegistry
		| undefined;

	restoreReply(channelId, options);

	if (message.content)
		registry?.getBestActiveInputForChannelId?.(channelId)?.insertText?.(message.content);
}

/**
 * @description Asks `guard` about every message before Discord sends it, by patching `sendMessage` on Discord's message
 * actions. A send the guard refuses goes back into the chat input with `restoreSend`. A GIF picker selection passes
 * straight through while GIF Paste is on, since that plugin pastes it into the input instead of sending it.
 * @param feature The feature's name, for the warning when Discord moved its message actions.
 * @param guard Decides whether each send goes out; it may change the message's content first.
 */
export function guardSends(feature: string, guard: SendGuard): void {
	const MessageActions = metro.api.Messages;

	if (!MessageActions) {
		logger.warn(`${feature} skipped: Discord moved MessageActions.`);

		return;
	}

	patcher.instead(MessageActions, 'sendMessage', async ({ args, original, this: self }) => {
		if (!isSendArgs(args) || isPastedGif(args)) return original.apply(self, args);

		if (await guard(args)) return original.apply(self, args);

		restoreSend(args);
	});
}

export default { guardSends, restoreSend };
