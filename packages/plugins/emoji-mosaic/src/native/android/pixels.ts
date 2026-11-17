import type { NativeBridge, NativeJavaValue } from '@unbound-app/api/native';
import { javaReference } from '@unbound-plugins/shared/native/android/java-values';

const string = (value: string): NativeJavaValue => ({ type: 'string', value });
const int = (value: number): NativeJavaValue => ({ type: 'int', value });
const bool = (value: boolean): NativeJavaValue => ({ type: 'boolean', value });

/**
 * @description Decodes an image file into RGBA pixels of a given size on Android: `BitmapFactory` loads it, it is
 * scaled to fill the size, and its bytes are copied out.
 * @param native The plugin's native bridge.
 * @param path The image's absolute path.
 * @param width The width to scale to.
 * @param height The height to scale to.
 * @returns The RGBA pixels, or `undefined` when the file is not an image Android can read.
 */
export function readPixels(
	{ java }: NativeBridge,
	path: string,
	width: number,
	height: number,
): Uint8Array | undefined {
	const decoded = javaReference(
		java.invoke(java.getClass('android.graphics.BitmapFactory'), 'decodeFile', [string(path)]),
	);

	if (!decoded) return undefined;

	const Bitmap = java.getClass('android.graphics.Bitmap');
	const ARGB_8888 = javaReference(
		java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888'),
	)!;
	const scaled = javaReference(
		java.invoke(Bitmap, 'createScaledBitmap', [decoded, int(width), int(height), bool(true)]),
	)!;
	const pixels = javaReference(java.invoke(scaled, 'copy', [ARGB_8888, bool(false)]))!;
	const buffer = javaReference(
		java.invoke(java.getClass('java.nio.ByteBuffer'), 'allocate', [int(width * height * 4)]),
	)!;

	java.invoke(pixels, 'copyPixelsToBuffer', [buffer]);

	const rgba = java.bytes(javaReference(java.invoke(buffer, 'array', []))!);

	for (const bitmap of [decoded, scaled, pixels]) java.invoke(bitmap, 'recycle', []);

	return rgba;
}

export default { readPixels };
