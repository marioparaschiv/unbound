import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge } from '@unbound-app/api/native';

import type { Raster } from '~/native/ios/rasterize';

const MAX_POINTS = 1024;
const SCREEN_SCALE = 3;

/**
 * @description Decodes an image file with `BitmapFactory`, which reads BMP, ICO, HEIF and, from Android 12, AVIF, and
 * writes it as a PNG with `Bitmap.compress`.
 * @param native The plugin's native bridge.
 * @param sourcePath The absolute path of the image file.
 * @param pngPath The absolute path to write the PNG to.
 * @returns The picture's size in points, or `undefined` when it could not be decoded.
 */
export async function decodeImageAndroid(
	native: NativeBridge,
	sourcePath: string,
	pngPath: string,
): Promise<Raster | undefined> {
	const { java } = native;
	const BitmapFactory = java.getClass('android.graphics.BitmapFactory');
	const bitmap = javaReference(
		java.invoke(BitmapFactory, 'decodeFile', [javaString(sourcePath)]),
	);

	if (!bitmap) return undefined;

	const width = javaNumber(java.invoke(bitmap, 'getWidth', [])) ?? 0;
	const height = javaNumber(java.invoke(bitmap, 'getHeight', [])) ?? 0;
	const output = java.construct('java.io.FileOutputStream', [javaString(pngPath)]);

	try {
		const png = java.getField(java.getClass('android.graphics.Bitmap$CompressFormat'), 'PNG');

		java.invoke(bitmap, 'compress', [png, javaInt(100), output]);
	} finally {
		java.invoke(output, 'close', []);
		java.invoke(bitmap, 'recycle', []);
	}

	if (!width || !height) return undefined;

	const zoom = Math.min(1 / SCREEN_SCALE, MAX_POINTS / Math.max(width, height));

	return {
		width: Math.max(1, Math.round(width * zoom)),
		height: Math.max(1, Math.round(height * zoom)),
	};
}
