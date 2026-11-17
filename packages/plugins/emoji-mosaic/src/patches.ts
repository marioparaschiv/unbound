import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { openMosaicSheet, type MosaicImage } from '~/components/mosaic-sheet';

const SHEET_SWAP_MS = 350;
const STILL_IMAGE = /\.(png|jpe?g|webp)$/i;

type Attachment = { url?: string; filename?: string; width?: number; height?: number };

type SheetProps = { message?: { id?: string; channel_id?: string; attachments?: Attachment[] } };

function firstImage(attachments: Attachment[] = []): MosaicImage | undefined {
	const image = attachments.find(
		({ url, filename, width, height }) =>
			url && width && height && STILL_IMAGE.test(filename ?? ''),
	);

	return image
		? { url: image.url!, width: image.width!, height: image.height!, filename: image.filename! }
		: undefined;
}

/**
 * @description Adds Make Emoji Mosaic to the long-press sheet of messages with a still image.
 * @param bridge The plugin's native bridge.
 * @param folder The plugin's temporary folder.
 */
export function patchActionSheets(bridge: NativeBridge, folder: string): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Emoji Mosaic row skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const channelId = props.message?.channel_id;
		const image = firstImage(props.message?.attachments);

		if (!key.endsWith('MessageLongPressActionSheet') || !channelId || !image) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-emoji-mosaic',
					label: messages.MAKE,
					icon: 'ReactionIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						setTimeout(
							() => openMosaicSheet({ channelId, image, bridge, folder }),
							SHEET_SWAP_MS,
						);
					},
				},
			]);

			return result;
		};
	});
}
