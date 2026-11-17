import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { fontAttachments, type FontAttachment } from '~/lib/font-file';
import { openFontSheet } from '~/components/font-sheet';
import { createFontHost } from '~/native/fonts';

const SHEET_SWAP_MS = 350;

type SheetProps = { message?: { id?: string; attachments?: FontAttachment[] } };

/**
 * @description Adds a Preview Font row to the message long-press sheet of messages with font attachments.
 * @param native The plugin's native bridge.
 * @param folder The plugin's temporary folder.
 */
export function patchActionSheets(native: NativeBridge, folder: string): void {
	const { ActionSheets } = metro.api;
	const host = createFontHost(native);

	if (!ActionSheets || !host) {
		logger.warn('Font Attachment Preview skipped: no action sheets or font loader here.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const messageId = props.message?.id;
		const fonts = fontAttachments(props.message?.attachments);

		if (!key.endsWith('MessageLongPressActionSheet') || !messageId || !fonts.length) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-font-preview',
					label: messages.PREVIEW,
					icon: 'LettersIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						setTimeout(
							() => openFontSheet(messageId, fonts, { host, folder }),
							SHEET_SWAP_MS,
						);
					},
				},
			]);

			return result;
		};
	});
}
