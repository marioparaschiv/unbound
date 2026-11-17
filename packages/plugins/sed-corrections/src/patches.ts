import { metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { applySubstitution, parseSubstitution } from '~/lib/sed';

type StoredMessage = { id?: string; author?: { id?: string }; content?: string };

type MessageList = { toArray(): StoredMessage[] };

type MessageActions = {
	sendMessage(
		channelId: string,
		message: { content?: string },
		...rest: unknown[]
	): Promise<unknown>;
	editMessage(
		channelId: string,
		messageId: string,
		message: { content: string },
	): Promise<unknown>;
};

function lastOwnMessage(
	list: MessageList | undefined,
	me: string | undefined,
): StoredMessage | undefined {
	return list
		?.toArray()
		.findLast((message) => message.author?.id === me && message.id && message.content);
}

/**
 * @description Turns a sent `s/find/replace/` into an edit of your latest message in the channel, among the loaded ones.
 * Patches `sendMessage` on Discord's message actions; reads messages from `MessageStore` and you from `UserStore`.
 */
export function patchSendMessage(): void {
	const Messages = metro.api.Messages as MessageActions | undefined;
	const MessageStore = metro.findByProps('getMessages', 'getMessage');
	const UserStore = metro.findByProps('getCurrentUser', 'getUser');

	if (!Messages?.sendMessage || !MessageStore || !UserStore) {
		logger.warn('Sed corrections skipped: Discord moved sendMessage or the stores it reads.');

		return;
	}

	patcher.instead(Messages, 'sendMessage', ({ args, original }) => {
		const [channelId, message] = args as [string, { content?: string }];
		const substitution = parseSubstitution(message?.content ?? '');

		if (!substitution) return original(...args);

		const target = lastOwnMessage(
			MessageStore.getMessages(channelId),
			UserStore.getCurrentUser()?.id,
		);

		if (!target?.id || !target.content) {
			toasts.show({ title: addon.name, content: messages.NO_MESSAGE });

			return Promise.resolve();
		}

		const corrected = applySubstitution(target.content, substitution);

		if (corrected === undefined) {
			toasts.show({
				title: addon.name,
				content: format('NO_MATCH', { pattern: substitution.pattern }),
			});

			return Promise.resolve();
		}

		return Messages.editMessage(channelId, target.id, { content: corrected });
	});
}
