import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { metro, patcher } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';

import { openPreviewSheet } from '~/components/preview-sheet';
import { isListableZip, type Attachment } from '~/lib/kinds';

type SheetProps = { message?: { attachments?: Attachment[] } };

const MAX_ROWS = 3;

/**
 * @description Adds a Show Files row for each zip archive attached to a message, up to three, to the message long-press
 * action sheet.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Zip previews skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const previewable = (props.message?.attachments ?? [])
			.filter(isListableZip)
			.slice(0, MAX_ROWS);

		if (!key.endsWith('MessageLongPressActionSheet') || !previewable.length) return;

		return (result) => {
			insertSheetRows(
				result,
				previewable.map((attachment, index) => ({
					key: `unbound-zip-preview-${index}`,
					label: format('PREVIEW_FILE', { name: attachment.filename ?? '' }),
					icon: 'FolderIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						openPreviewSheet({
							name: attachment.filename ?? '',
							url: attachment.url ?? '',
						});
					},
				})),
			);

			return result;
		};
	});
}
