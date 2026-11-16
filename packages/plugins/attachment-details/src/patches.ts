import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import DetailsSheet from '~/components/details-sheet';
import type { Attachment } from '~/lib/details';

type SheetProps = { message?: { attachments?: Attachment[] } };

/**
 * @description Adds Attachment Details to the long-press action sheet of messages with attachments.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Attachment Details skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const attachments = props.message?.attachments;

		if (!key.endsWith('MessageLongPressActionSheet') || !attachments?.length) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-attachment-details',
					label: messages.DETAILS,
					icon: 'CircleInformationIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						openSheet('unbound-attachment-details', DetailsSheet, { attachments });
					},
				},
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
