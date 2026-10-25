import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import { javaBoolean, javaFloat, javaInt, javaReference, javaString } from './java-values';

const ANTI_ALIAS_FLAG = 1;

export type AndroidImageBridge = Pick<NativeJavaBridge, 'getClass' | 'invoke' | 'construct'>;

function encodeBase64(bytes: Uint8Array): string {
	let binary = '';

	for (const byte of bytes) binary += String.fromCharCode(byte);

	return btoa(binary);
}

function enumValue(java: AndroidImageBridge, className: string, name: string) {
	return javaReference(java.invoke(java.getClass(className), 'valueOf', [javaString(name)]));
}

/**
 * @description Decodes image bytes into an Android `Bitmap`.
 * @param java The plugin's Java bridge.
 * @param bytes The encoded image, such as a PNG or WebP.
 * @returns The bitmap, or `null` when Android could not decode it.
 */
export function decodeBitmap(
	java: AndroidImageBridge,
	bytes: Uint8Array,
): NativeJavaReference | null {
	const data = javaReference(
		java.invoke(java.getClass('android.util.Base64'), 'decode', [
			javaString(encodeBase64(bytes)),
			javaInt(0),
		]),
	);

	if (!data) return null;

	return javaReference(
		java.invoke(java.getClass('android.graphics.BitmapFactory'), 'decodeByteArray', [
			data,
			javaInt(0),
			javaInt(bytes.length),
		]),
	);
}

/**
 * @description Scales a bitmap into a square and clips it to a circle.
 * @param java The plugin's Java bridge.
 * @param source The bitmap.
 * @param size The side of the result, in pixels.
 * @returns The circular bitmap, or `null` when a step failed.
 */
export function circularBitmap(
	java: AndroidImageBridge,
	source: NativeJavaReference,
	size: number,
): NativeJavaReference | null {
	const Bitmap = java.getClass('android.graphics.Bitmap');
	const scaled = javaReference(
		java.invoke(Bitmap, 'createScaledBitmap', [
			source,
			javaInt(size),
			javaInt(size),
			javaBoolean(true),
		]),
	);
	const config = enumValue(java, 'android.graphics.Bitmap$Config', 'ARGB_8888');
	const clamp = enumValue(java, 'android.graphics.Shader$TileMode', 'CLAMP');

	if (!scaled || !config || !clamp) return null;

	const result = javaReference(
		java.invoke(Bitmap, 'createBitmap', [javaInt(size), javaInt(size), config]),
	);

	if (!result) return null;

	const canvas = java.construct('android.graphics.Canvas', [result]);
	const paint = java.construct('android.graphics.Paint', [javaInt(ANTI_ALIAS_FLAG)]);
	const radius = javaFloat(size / 2);

	java.invoke(paint, 'setShader', [
		java.construct('android.graphics.BitmapShader', [scaled, clamp, clamp]),
	]);
	java.invoke(canvas, 'drawCircle', [radius, radius, radius, paint]);

	return result;
}

/**
 * @description Wraps a bitmap in a drawable sized for inline text.
 * @param java The plugin's Java bridge.
 * @param resources The text view's `Resources`.
 * @param bitmap The bitmap.
 * @param size The drawable's side, in pixels.
 * @returns The `BitmapDrawable`.
 */
export function inlineDrawable(
	java: AndroidImageBridge,
	resources: NativeJavaReference,
	bitmap: NativeJavaReference,
	size: number,
): NativeJavaReference {
	const drawable = java.construct('android.graphics.drawable.BitmapDrawable', [
		resources,
		bitmap,
	]);

	java.invoke(drawable, 'setBounds', [javaInt(0), javaInt(0), javaInt(size), javaInt(size)]);

	return drawable;
}

export default { circularBitmap, decodeBitmap, inlineDrawable };
