import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge } from '@unbound-app/api/native';
import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import { removeBackground } from '~/lib/remove-background';
import { imageOf, type ImageAttachment } from '~/lib/image';

type SheetProps = { message?: { channel_id?: string; attachments?: ImageAttachment[] } };

/**
 * @description Adds Remove Background to the long-press sheet of messages with a still image.
 * @param native The plugin's native bridge, which cuts images.
 * @param folder The plugin's temporary folder.
 */
export function patchActionSheets(native: NativeBridge, folder: string): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Remove Background skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const image = imageOf(props.message?.attachments);
		const channelId = props.message?.channel_id;

		if (!key.endsWith('MessageLongPressActionSheet') || !image || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-background-remover',
					label: messages.REMOVE_BACKGROUND,
					icon: 'MagicWandIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						void removeBackground(native, folder, channelId, image);
					},
				},
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
