import type { NativeBridge, NativeJavaReference, NativeJavaValue } from '@unbound-app/api/native';
import { javaReference } from '@unbound-plugins/shared/native/android/java-values';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';

import { clearPlainBackground } from '~/lib/flood';

const MAX_SIDE = 640;
const PNG_QUALITY = 100;

type Java = NativeBridge['java'];

const string = (value: string): NativeJavaValue => ({ type: 'string', value });
const int = (value: number): NativeJavaValue => ({ type: 'int', value: Math.round(value) });
const bool = (value: boolean): NativeJavaValue => ({ type: 'boolean', value });

function numberOf(value: unknown): number {
	return Number((value as { value?: unknown } | null)?.value ?? value) || 0;
}

function argb(java: Java): NativeJavaReference {
	return javaReference(
		java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888'),
	)!;
}

function readImage(java: Java, path: string) {
	const decoded = javaReference(
		java.invoke(java.getClass('android.graphics.BitmapFactory'), 'decodeFile', [string(path)]),
	);

	if (!decoded) return undefined;

	const sourceWidth = numberOf(java.invoke(decoded, 'getWidth', []));
	const sourceHeight = numberOf(java.invoke(decoded, 'getHeight', []));
	const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
	const width = Math.max(1, Math.round(sourceWidth * scale));
	const height = Math.max(1, Math.round(sourceHeight * scale));
	const scaled = javaReference(
		java.invoke(java.getClass('android.graphics.Bitmap'), 'createScaledBitmap', [
			decoded,
			int(width),
			int(height),
			bool(true),
		]),
	)!;
	const pixels = javaReference(java.invoke(scaled, 'copy', [argb(java), bool(false)]))!;
	const buffer = javaReference(
		java.invoke(java.getClass('java.nio.ByteBuffer'), 'allocate', [int(width * height * 4)]),
	)!;

	java.invoke(pixels, 'copyPixelsToBuffer', [buffer]);

	const rgba = java.bytes(javaReference(java.invoke(buffer, 'array', []))!);

	for (const bitmap of [decoded, scaled, pixels]) java.invoke(bitmap, 'recycle', []);

	return { width, height, rgba };
}

function premultiplied(rgba: Uint8Array): Uint8Array {
	const result = Uint8Array.from(rgba);

	for (let offset = 0; offset < result.length; offset += 4) {
		const alpha = result[offset + 3]! / 255;

		result[offset] = Math.round(result[offset]! * alpha);
		result[offset + 1] = Math.round(result[offset + 1]! * alpha);
		result[offset + 2] = Math.round(result[offset + 2]! * alpha);
	}

	return result;
}

function writePng(java: Java, rgba: Uint8Array, width: number, height: number): string | undefined {
	const bitmap = javaReference(
		java.invoke(java.getClass('android.graphics.Bitmap'), 'createBitmap', [
			int(width),
			int(height),
			argb(java),
		]),
	)!;
	const output = java.construct('java.io.ByteArrayOutputStream', []);
	const PNG = javaReference(
		java.getField(java.getClass('android.graphics.Bitmap$CompressFormat'), 'PNG'),
	)!;

	java.invoke(bitmap, 'copyPixelsFromBuffer', [
		javaReference(
			java.invoke(java.getClass('java.nio.ByteBuffer'), 'wrap', [
				{ type: 'bytes', value: premultiplied(rgba) },
			]),
		)!,
	]);
	java.invoke(bitmap, 'compress', [PNG, int(PNG_QUALITY), output]);
	java.invoke(bitmap, 'recycle', []);

	return toBase64(java.bytes(javaReference(java.invoke(output, 'toByteArray', []))!));
}

/**
 * @description Cuts a subject out of a plain background on Android, where no on-device subject model is available:
 * the image is scaled to at most 640 pixels, its background cleared from the edges, and the result written as a PNG.
 * @param native The plugin's native bridge.
 * @param path The image's absolute path.
 * @returns The PNG as base64, or `undefined` when the background isn't plain enough to clear.
 */
export function cutOut({ java }: NativeBridge, path: string): string | undefined {
	const image = readImage(java, path);
	const cleared = image ? clearPlainBackground(image.rgba, image.width, image.height) : undefined;

	return image && cleared ? writePng(java, cleared, image.width, image.height) : undefined;
}

export default { cutOut };
