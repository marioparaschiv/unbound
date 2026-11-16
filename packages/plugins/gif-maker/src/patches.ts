import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import type { NativeBridge } from '@unbound-app/api/native';
import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import GifMakerSheet from '~/components/gif-maker-sheet';
import { videoOf, type VideoAttachment } from '~/lib/video';

type SheetProps = {
	message?: { channel_id?: string; attachments?: VideoAttachment[] };
};

/**
 * @description Adds Make GIF to the long-press action sheet of messages with a video attachment.
 * @param native The plugin's native bridge, which reads the video's frames.
 * @param folder The plugin's temporary folder, for the video and the GIF.
 */
export function patchActionSheets(native: NativeBridge, folder: string): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Make GIF skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const video = videoOf(props.message?.attachments);
		const channelId = props.message?.channel_id;

		if (!key.endsWith('MessageLongPressActionSheet') || !video?.url || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-gif-maker',
					label: messages.MAKE_GIF,
					icon: 'GifIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						openSheet('unbound-gif-maker', GifMakerSheet, {
							url: video.url!,
							channelId,
							native,
							folder,
						});
					},
				},
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
