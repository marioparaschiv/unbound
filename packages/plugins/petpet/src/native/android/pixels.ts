import type { NativeBridge, NativeJavaValue } from '@unbound-app/api/native';
import { javaReference } from '@unbound-plugins/shared/native/android/java-values';

const BASE64_NO_WRAP = 2;

const string = (value: string): NativeJavaValue => ({ type: 'string', value });
const int = (value: number): NativeJavaValue => ({ type: 'int', value });
const bool = (value: boolean): NativeJavaValue => ({ type: 'boolean', value });

/**
 * @description Decodes an image file into square RGBA pixels on Android: `BitmapFactory` loads it, it is scaled to
 * the square, and its bytes are copied out.
 * @param native The plugin's native bridge.
 * @param path The image's absolute path.
 * @param size The square's width and height.
 * @returns The pixels as base64, or `undefined` when the file is not an image Android can read.
 */
export function readPixels({ java }: NativeBridge, path: string, size: number): string | undefined {
	const decoded = javaReference(
		java.invoke(java.getClass('android.graphics.BitmapFactory'), 'decodeFile', [string(path)]),
	);

	if (!decoded) return undefined;

	const Bitmap = java.getClass('android.graphics.Bitmap');
	const ARGB_8888 = javaReference(
		java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888'),
	)!;
	const scaled = javaReference(
		java.invoke(Bitmap, 'createScaledBitmap', [decoded, int(size), int(size), bool(true)]),
	)!;
	const pixels = javaReference(java.invoke(scaled, 'copy', [ARGB_8888, bool(false)]))!;
	const buffer = javaReference(
		java.invoke(java.getClass('java.nio.ByteBuffer'), 'allocate', [int(size * size * 4)]),
	)!;

	java.invoke(pixels, 'copyPixelsToBuffer', [buffer]);

	const base64 = java.invoke(java.getClass('android.util.Base64'), 'encodeToString', [
		javaReference(java.invoke(buffer, 'array', []))!,
		int(BASE64_NO_WRAP),
	]) as { value?: unknown } | string | null;

	for (const bitmap of [decoded, scaled, pixels]) java.invoke(bitmap, 'recycle', []);

	const text = typeof base64 === 'string' ? base64 : base64?.value;

	return typeof text === 'string' ? text : undefined;
}

export default { readPixels };
