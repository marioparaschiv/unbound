import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { metro, patcher } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';

import { openSvgSheet } from '~/components/svg-sheet';
import { isSvg, type Attachment } from '~/lib/svg';

type SheetProps = { message?: { attachments?: Attachment[] } };

const MAX_ROWS = 3;

/**
 * @description Adds a View row for each SVG attached to a message, up to three, to the message long-press action sheet.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets || !metro.findByProps('SvgXml')) {
		logger.warn('SVG viewer skipped: Discord moved ActionSheets or react-native-svg.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const svgs = (props.message?.attachments ?? []).filter(isSvg).slice(0, MAX_ROWS);

		if (!key.endsWith('MessageLongPressActionSheet') || !svgs.length) return;

		return (result) => {
			insertSheetRows(
				result,
				svgs.map((attachment, index) => ({
					key: `unbound-svg-viewer-${index}`,
					label: format('VIEW_SVG', { name: attachment.filename ?? '' }),
					icon: 'ImageIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						openSvgSheet({
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
