import type { NativeBridge, NativeJavaReference, NativeJavaValue } from '@unbound-app/api/native';
import { javaReference } from '@unbound-plugins/shared/native/android/java-values';
import { fromBase64, toBase64 } from '@unbound-plugins/shared/media/gif/base64';

import { clearPlainBackground } from '~/lib/flood';

const MAX_SIDE = 640;
const BASE64_NO_WRAP = 2;
const PNG_QUALITY = 100;
const CHUNK_CHARACTERS = 4000;

type Java = NativeBridge['java'];

const string = (value: string): NativeJavaValue => ({ type: 'string', value });
const int = (value: number): NativeJavaValue => ({ type: 'int', value: Math.round(value) });
const bool = (value: boolean): NativeJavaValue => ({ type: 'boolean', value });

function numberOf(value: unknown): number {
	return Number((value as { value?: unknown } | null)?.value ?? value) || 0;
}

function textOf(value: unknown): string | undefined {
	const read = (value as { value?: unknown } | null)?.value ?? value;

	return typeof read === 'string' ? read : undefined;
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

	const encoded = textOf(
		java.invoke(java.getClass('android.util.Base64'), 'encodeToString', [
			javaReference(java.invoke(buffer, 'array', []))!,
			int(BASE64_NO_WRAP),
		]),
	);

	for (const bitmap of [decoded, scaled, pixels]) java.invoke(bitmap, 'recycle', []);

	return encoded ? { width, height, rgba: fromBase64(encoded) } : undefined;
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

function filledBuffer(java: Java, base64: string, length: number): NativeJavaReference {
	const Base64 = java.getClass('android.util.Base64');
	const buffer = javaReference(
		java.invoke(java.getClass('java.nio.ByteBuffer'), 'allocate', [int(length)]),
	)!;

	for (let start = 0; start < base64.length; start += CHUNK_CHARACTERS) {
		const bytes = javaReference(
			java.invoke(Base64, 'decode', [
				string(base64.slice(start, start + CHUNK_CHARACTERS)),
				int(BASE64_NO_WRAP),
			]),
		)!;

		java.invoke(buffer, 'put', [bytes]);
	}

	java.invoke(buffer, 'rewind', []);

	return buffer;
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
		filledBuffer(java, toBase64(premultiplied(rgba)), rgba.length),
	]);
	java.invoke(bitmap, 'compress', [PNG, int(PNG_QUALITY), output]);
	java.invoke(bitmap, 'recycle', []);

	return textOf(
		java.invoke(java.getClass('android.util.Base64'), 'encodeToString', [
			javaReference(java.invoke(output, 'toByteArray', []))!,
			int(BASE64_NO_WRAP),
		]),
	);
}

/**
 * @description Cuts a subject out of a plain background on Android, where no on-device subject model is available:
 * the image is scaled to at most 640 pixels, its background cleared from the edges, and the result written as a PNG.
 * Pixels go back to Java in 4,000-character base64 chunks, under the bridge's argument limit.
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
