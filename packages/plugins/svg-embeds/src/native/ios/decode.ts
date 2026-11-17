import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { pngSize } from '~/lib/png';
import type { Raster } from '~/native/ios/rasterize';

const MAX_POINTS = 1024;
const SCREEN_SCALE = 3;

/**
 * @description Decodes an image file with ImageIO, through `UIImage`, and writes it as a PNG.
 * @param native The plugin's native bridge.
 * @param sourcePath The absolute path of the image file.
 * @param pngPath The absolute path to write the PNG to.
 * @returns The picture's size in points, or `undefined` when ImageIO cannot read the file.
 */
export async function decodeImageIOS(
	native: NativeBridge,
	sourcePath: string,
	pngPath: string,
): Promise<Raster | undefined> {
	const { objc, ffi } = native;
	const UIImage = objc.getClass('UIImage');
	const pngData = ffi.symbol('UIImagePNGRepresentation');

	if (!UIImage || !pngData) return undefined;

	const image = objc.call(
		UIImage,
		'imageWithContentsOfFile:',
		sourcePath,
	) as NativeObjectHandle | null;
	const bytes = image
		? ffi.call(pngData, { returnType: 'object', args: ['object'] }, image)
		: undefined;

	if (!(bytes instanceof Uint8Array)) return undefined;

	const size = pngSize(bytes);

	if (!size || objc.call(objc.data(bytes), 'writeToFile:atomically:', pngPath, true) !== true)
		return undefined;

	const zoom = Math.min(1 / SCREEN_SCALE, MAX_POINTS / Math.max(size.width, size.height));

	return {
		width: Math.max(1, Math.round(size.width * zoom)),
		height: Math.max(1, Math.round(size.height * zoom)),
	};
}
