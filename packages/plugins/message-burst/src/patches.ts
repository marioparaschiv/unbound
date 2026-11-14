import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { burstContent, type LastMessage } from '~/lib/burst';

type StoredMessage = {
	id?: string;
	author?: { id?: string };
	timestamp?: { valueOf(): number };
	state?: string;
	attachments?: unknown[];
	content?: string;
};

type OutgoingMessage = { content?: string };

type SendOptions = { messageReference?: unknown };

type MessageActions = {
	sendMessage(channelId: string, message: OutgoingMessage, ...rest: unknown[]): Promise<unknown>;
	editMessage(
		channelId: string,
		messageId: string,
		message: { content: string },
	): Promise<unknown>;
};

function lastMessageOf(stored: StoredMessage | undefined): LastMessage | undefined {
	if (!stored?.id) return undefined;

	return {
		authorId: stored.author?.id,
		sentAt: Number(stored.timestamp?.valueOf() ?? 0),
		sent: stored.state === 'SENT',
		attachments: stored.attachments?.length ?? 0,
		content: stored.content ?? '',
	};
}

/**
 * @description Turns a message sent right after your own into an edit of that message. Patches `sendMessage` on
 * Discord's message actions; reads the channel's last message from `MessageStore`, you from `UserStore` and the length
 * limit from `getMaxMessageLength`.
 */
export function patchSendMessage(): void {
	const Messages = metro.api.Messages as MessageActions | undefined;
	const MessageStore = metro.findByProps('getMessages', 'getMessage');
	const UserStore = metro.findByProps('getCurrentUser', 'getUser');
	const Length = metro.findByProps('getMaxMessageLength');

	if (!Messages?.sendMessage || !MessageStore || !UserStore || !Length) {
		logger.warn('Message bursts skipped: Discord moved sendMessage or the stores it reads.');

		return;
	}

	patcher.instead(Messages, 'sendMessage', ({ args, original }) => {
		const [channelId, message, , options] = args as [
			string,
			OutgoingMessage,
			unknown,
			SendOptions | undefined,
		];
		const stored: StoredMessage | undefined = MessageStore.getMessages(channelId)?.last?.();
		const merged = burstContent(lastMessageOf(stored), message?.content ?? '', {
			me: UserStore.getCurrentUser()?.id ?? '',
			now: Date.now(),
			seconds: settings.seconds,
			attachments: settings.attachments,
			replying: Boolean(options?.messageReference),
			maxLength: Length.getMaxMessageLength(),
			separator: settings.space ? ' ' : '\n',
		});

		if (merged === undefined || !stored?.id) return original(...args);

		return Messages.editMessage(channelId, stored.id, { content: merged });
	});
}
