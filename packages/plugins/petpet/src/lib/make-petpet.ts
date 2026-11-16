import { encodeGif } from '@unbound-plugins/shared/media/gif/gif-encoder';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import { buildPalette } from '@unbound-plugins/shared/media/gif/palette';
import type { NativeBridge } from '@unbound-app/api/native';
import { fs, toasts } from '@unbound-app/api';

import { FRAME_DELAY_CENTISECONDS, FRAME_SIZE, petpetFrames } from '~/lib/petpet';
import { readSquarePixels } from '~/native/pixels';

const SOURCE_SIZE = 96;
const PALETTE_COLORS = 255;

async function download(url: string, folder: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const path = `${folder}/${Date.now()}/source.png`;

	await fs.writeFile(path, toBase64(new Uint8Array(await response.arrayBuffer())), 'base64');

	return `${fs.documentsPath}/${path}`;
}

/**
 * @description Makes a head-patting GIF from an image and adds it to a channel's chat input, with a toast when it is
 * added or failed.
 * @param native The plugin's native bridge, which decodes the image.
 * @param folder The plugin's temporary folder.
 * @param channelId The channel whose chat input gets the GIF.
 * @param url The image's address.
 */
export async function makePetPet(
	native: NativeBridge,
	folder: string,
	channelId: string,
	url: string,
): Promise<void> {
	try {
		const pixels = readSquarePixels(native, await download(url, folder), SOURCE_SIZE);

		if (!pixels) throw new Error('the image could not be decoded');

		const frames = petpetFrames(pixels, SOURCE_SIZE);
		const gif = encodeGif(frames, {
			width: FRAME_SIZE,
			height: FRAME_SIZE,
			delayCentiseconds: FRAME_DELAY_CENTISECONDS,
			palette: buildPalette(frames, PALETTE_COLORS),
			transparent: true,
		});

		await attachFile(channelId, toBase64(gif), {
			folder,
			filename: 'petpet.gif',
			mimeType: 'image/gif',
			encoding: 'base64',
			size: { width: FRAME_SIZE, height: FRAME_SIZE },
		});
		toasts.success('ADDED');
	} catch (error) {
		logger.error(`Failed to make a petpet GIF from ${url}:`, error);
		toasts.error('FAILED', error);
	}
}

export default { makePetPet };
