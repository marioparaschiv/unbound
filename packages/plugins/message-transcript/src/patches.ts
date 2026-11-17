import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { openSelectSheet } from '~/components/select-sheet';

const SHEET_SWAP_MS = 350;

type SheetProps = { message?: { id?: string; channel_id?: string } };

/**
 * @description Adds a Select Messages row to the message long-press sheet.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Message Transcript row skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const { id: messageId, channel_id: channelId } = props.message ?? {};

		if (!key.endsWith('MessageLongPressActionSheet') || !messageId || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-message-transcript',
					label: messages.SELECT,
					icon: 'CopyIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						setTimeout(() => openSelectSheet({ channelId, messageId }), SHEET_SWAP_MS);
					},
				},
			]);

			return result;
		};
	});
}
