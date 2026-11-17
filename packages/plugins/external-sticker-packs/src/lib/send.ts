import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import { toBase64 } from '@unbound-plugins/shared/media/sound-download';

import { stickerUrl, type Sticker } from '~/lib/line';

/**
 * @description Downloads a sticker's image and adds it to a channel's attachments.
 * @param channelId The channel whose chat input gets it.
 * @param sticker The sticker.
 * @param folder The plugin's temporary folder.
 * @returns Whether it was attached.
 */
export async function attachSticker(
	channelId: string,
	sticker: Sticker,
	folder: string,
): Promise<boolean> {
	try {
		const response = await fetch(stickerUrl(sticker.id));

		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const bytes = new Uint8Array(await response.arrayBuffer());

		return await attachFile(channelId, toBase64(bytes), {
			folder,
			filename: `line-${sticker.id}.png`,
			mimeType: 'image/png',
			encoding: 'base64',
			...(sticker.width && sticker.height
				? { size: { width: sticker.width, height: sticker.height } }
				: {}),
		});
	} catch (error) {
		logger.error(`Failed to attach LINE sticker ${sticker.id}:`, error);

		return false;
	}
}
