import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { flux, metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { firstReplyTo, type ReplyMessage } from '~/lib/replies';

type SheetMessage = { id?: string; channel_id?: string };

type SheetProps = { message?: SheetMessage };

type MessageStore = { getMessages(channelId: string): { toArray(): ReplyMessage[] } };

type REST = { get(request: { url: string; query?: object }): Promise<{ body?: ReplyMessage[] }> };

const SEARCH_LIMIT = 100;

async function findReply(channelId: string, messageId: string): Promise<string | undefined> {
	const Messages = flux.getStore('Message') as unknown as MessageStore;
	const loaded = firstReplyTo(Messages.getMessages(channelId).toArray(), messageId);

	if (loaded) return loaded;

	const response = await (metro.common.REST as REST).get({
		url: `/channels/${channelId}/messages`,
		query: { after: messageId, limit: SEARCH_LIMIT },
	});

	return firstReplyTo(response.body ?? [], messageId);
}

async function jumpToReply(channelId: string, messageId: string): Promise<void> {
	try {
		const reply = await findReply(channelId, messageId);

		if (!reply) {
			toasts.show({ title: addon.name, content: messages.NO_REPLY });

			return;
		}

		metro.api.Messages.jumpToMessage({ channelId, messageId: reply, flash: true });
	} catch (error) {
		logger.error(`Failed to find a reply to message ${messageId}:`, error);
		toasts.show({ title: addon.name, content: messages.FIND_FAILED });
	}
}

/**
 * @description Adds a Jump to Reply row to the message long-press action sheet, which jumps to the first reply to the message:
 * one already loaded, or one among the next 100 messages the API returns.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Find reply skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const { id: messageId, channel_id: channelId } = props.message ?? {};

		if (!key.endsWith('MessageLongPressActionSheet') || !messageId || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-find-reply',
					label: messages.FIND_REPLY,
					icon: 'ArrowAngleRightUpIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						void jumpToReply(channelId, messageId);
					},
				},
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
