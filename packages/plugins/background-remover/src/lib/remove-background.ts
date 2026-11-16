import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import type { NativeBridge } from '@unbound-app/api/native';
import { fs, toasts } from '@unbound-app/api';

import { cutoutName, type ImageAttachment } from '~/lib/image';
import { cutOutImage } from '~/native/cut-out';

const MAX_BYTES = 25 * 1024 * 1024;

async function download(url: string, folder: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const bytes = new Uint8Array(await response.arrayBuffer());

	if (bytes.byteLength > MAX_BYTES) throw new Error('the image is over 25 MB');

	const path = `${folder}/${Date.now()}/source`;

	await fs.writeFile(path, toBase64(bytes), 'base64');

	return `${fs.documentsPath}/${path}`;
}

/**
 * @description Cuts the subject out of an image and adds it to a channel's chat input as a transparent PNG, with a
 * toast saying how it went.
 * @param native The plugin's native bridge, which cuts the image.
 * @param folder The plugin's temporary folder.
 * @param channelId The channel whose chat input gets the cutout.
 * @param image The image attachment.
 */
export async function removeBackground(
	native: NativeBridge,
	folder: string,
	channelId: string,
	image: ImageAttachment,
): Promise<void> {
	const working = toasts.info('WORKING', { duration: 0 });

	try {
		const png = cutOutImage(native, await download(image.url!, folder));

		if (!png) {
			toasts.warning('NO_SUBJECT');

			return;
		}

		await attachFile(channelId, png, {
			folder,
			filename: cutoutName(image.filename),
			mimeType: 'image/png',
			encoding: 'base64',
		});
		toasts.success('ADDED');
	} catch (error) {
		logger.error(`Failed to remove the background of ${image.url}:`, error);
		toasts.error('FAILED', error);
	} finally {
		working.close();
	}
}

export default { removeBackground };
