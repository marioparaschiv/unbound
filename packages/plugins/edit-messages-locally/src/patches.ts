import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';
import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import { openEditSheet } from '~/components/edit-sheet';
import { takeRedraw } from '~/lib/redraw';
import { getEdits } from '~/lib/store';

type SheetMessage = { id?: string; channel_id?: string; content?: string };

type SheetProps = { message?: SheetMessage };

type ChangeInput = { message?: { id?: string } };

type ChatManagerClass = { prototype?: { determineChangeType?: (input: ChangeInput) => number } };

const CHANGE_TYPE_NONE = 0;
const CHANGE_TYPE_UPDATE = 2;

type ContentMessage = RowMessage & {
	id?: string;
	content?: string;
	set?: (key: 'content', value: string) => ContentMessage;
};

/**
 * @description Shows each message's local edit in place of its text, on a copy Discord builds the row from, so the stored
 * message keeps its real content. Hooks `generateMessageRowData` before it runs.
 */
export function patchMessageRows(): void {
	onMessageRow<ContentMessage>({
		feature: 'Local edits',
		before({ input, message }) {
			const edit = message?.id ? getEdits()[message.id] : undefined;

			if (!input || edit === undefined || typeof message?.set !== 'function')
				return undefined;

			return { input: { ...input, message: message.set('content', edit) } };
		},
	});
}

/**
 * @description Makes the chat send a row to the native list after its local edit changed, which Discord would otherwise
 * see as unchanged. Patches `determineChangeType` on Discord's `ChatManager`.
 */
export function patchChangeType(): void {
	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (ChatManager: ChatManagerClass) => {
		if (typeof ChatManager.prototype?.determineChangeType !== 'function') {
			logger.warn(
				'Instant local edits skipped: Discord moved ChatManager.determineChangeType.',
			);

			return;
		}

		patcher.after(ChatManager.prototype, 'determineChangeType', ({ args: [input], result }) => {
			const messageId = (input as ChangeInput | undefined)?.message?.id;

			if (result !== CHANGE_TYPE_NONE || !messageId || !takeRedraw(messageId)) return;

			return CHANGE_TYPE_UPDATE;
		});
	});
}

/**
 * @description Adds an Edit Locally row to the message long-press action sheet.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Edit Locally row skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const { id: messageId, channel_id: channelId, content } = props.message ?? {};

		if (!key.endsWith('MessageLongPressActionSheet') || !messageId || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-edit-locally',
					label: messages.EDIT_LOCALLY,
					icon: 'PencilIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						openEditSheet({ channelId, messageId, original: content ?? '' });
					},
				},
			]);

			return result;
		};
	});
}
