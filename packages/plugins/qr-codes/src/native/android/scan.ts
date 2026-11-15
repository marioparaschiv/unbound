import {
	javaInt,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaReference } from '@unbound-app/api/native';

import { findZXing, type ZXingClasses } from '~/native/android/zxing';
import { toBase64 } from '~/lib/base64';

const FILE_PATH = 'Unbound/cache/qr-scan';
const BASE64_DEFAULT = 0;
const CHUNK_CHARACTERS = 4000;
const MAX_SIDE = 1200;
const LUMINANCE_TO_ALPHA = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

type Java = NativeBridge['java'];

let zxing: ZXingClasses | null | undefined;

// Discord's build inlines the reader's empty constructor, so it is allocated without one; ZXing sets its readers up on first decode.
function newReader(java: Java, name: string): NativeJavaReference {
	const unsafe = javaReference(java.getField(java.getClass('sun.misc.Unsafe'), 'theUnsafe'));

	if (!unsafe) throw new Error('no Unsafe to allocate the reader');

	const reader = javaReference(java.invoke(unsafe, 'allocateInstance', [java.getClass(name)]));

	if (!reader) throw new Error('the reader could not be allocated');

	return reader;
}

function writeImage(java: Java, base64: string): NativeJavaReference {
	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);
	const files = app && javaReference(java.invoke(app, 'getFilesDir', []));

	if (!files) throw new Error('no files directory');

	const file = java.construct('java.io.File', [files, javaString(FILE_PATH)]);

	java.invoke(javaReference(java.invoke(file, 'getParentFile', []))!, 'mkdirs', []);
	const stream = java.construct('java.io.FileOutputStream', [file]);
	const Base64 = java.getClass('android.util.Base64');

	try {
		for (let offset = 0; offset < base64.length; offset += CHUNK_CHARACTERS) {
			const bytes = javaReference(
				java.invoke(Base64, 'decode', [
					javaString(base64.slice(offset, offset + CHUNK_CHARACTERS)),
					javaInt(BASE64_DEFAULT),
				]),
			);

			if (!bytes) throw new Error(`no decoded bytes at ${offset}`);

			java.invoke(stream, 'write', [bytes]);
		}
	} finally {
		java.invoke(stream, 'close', []);
	}

	return file;
}

function numberOf(java: Java, target: NativeJavaReference, method: string): number {
	const value = java.invoke(target, method, []);

	return value.type === 'int' ? value.value : 0;
}

function luminance(java: Java, file: NativeJavaReference) {
	const path = javaText(java.invoke(file, 'getAbsolutePath', []));
	const bitmap =
		path &&
		javaReference(
			java.invoke(java.getClass('android.graphics.BitmapFactory'), 'decodeFile', [
				javaString(path),
			]),
		);

	if (!bitmap) throw new Error('the image could not be decoded');

	const width = numberOf(java, bitmap, 'getWidth');
	const height = numberOf(java, bitmap, 'getHeight');
	const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
	const w = Math.max(4, Math.floor((width * scale) / 4) * 4);
	const h = Math.max(1, Math.round(height * scale));
	const config = javaReference(
		java.invoke(java.getClass('android.graphics.Bitmap$Config'), 'valueOf', [
			javaString('ALPHA_8'),
		]),
	);
	const gray = javaReference(
		java.invoke(java.getClass('android.graphics.Bitmap'), 'createBitmap', [
			javaInt(w),
			javaInt(h),
			config!,
		]),
	)!;
	const matrix = [...LUMINANCE_TO_ALPHA];

	matrix[15] = 0.299;
	matrix[16] = 0.587;
	matrix[17] = 0.114;

	const colorMatrix = java.construct('android.graphics.ColorMatrix', [
		{ type: 'array', componentType: 'float', value: matrix },
	]);
	const paint = java.construct('android.graphics.Paint', []);
	const src = javaReference(
		java.invoke(java.getClass('android.graphics.PorterDuff$Mode'), 'valueOf', [
			javaString('SRC'),
		]),
	)!;

	java.invoke(paint, 'setColorFilter', [
		java.construct('android.graphics.ColorMatrixColorFilter', [colorMatrix]),
	]);
	java.invoke(paint, 'setXfermode', [
		java.construct('android.graphics.PorterDuffXfermode', [src]),
	]);
	java.invoke(paint, 'setFilterBitmap', [{ type: 'boolean', value: true }]);
	java.invoke(java.construct('android.graphics.Canvas', [gray]), 'drawBitmap', [
		bitmap,
		{ type: 'null', class: 'android.graphics.Rect' },
		java.construct('android.graphics.Rect', [javaInt(0), javaInt(0), javaInt(w), javaInt(h)]),
		paint,
	]);

	const rowBytes = numberOf(java, gray, 'getRowBytes');
	const buffer = javaReference(
		java.invoke(java.getClass('java.nio.ByteBuffer'), 'allocate', [javaInt(rowBytes * h)]),
	)!;

	java.invoke(gray, 'copyPixelsToBuffer', [buffer]);
	java.invoke(bitmap, 'recycle', []);
	java.invoke(gray, 'recycle', []);

	return { bytes: javaReference(java.invoke(buffer, 'array', []))!, width: rowBytes, height: h };
}

/**
 * @description Reads the first QR code in an image with the ZXing build Discord's QR scanner carries: the picture is
 * drawn into a grey luminance plane, as a camera frame would be, and handed to the scanner's own decode task.
 * @param native The plugin's native bridge.
 * @param url The image's address.
 * @returns The code's text, or `undefined` when the image holds none.
 */
export async function scanOnAndroid(
	{ java }: NativeBridge,
	url: string,
): Promise<string | undefined> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const base64 = toBase64(await response.arrayBuffer());

	zxing ??= findZXing(java) ?? null;

	if (!zxing) throw new Error('Discord no longer carries its QR scanner');

	const { bytes, width, height } = luminance(java, writeImage(java, base64));
	const size = () => java.construct(zxing!.point, [javaInt(width), javaInt(height)]);
	const task = java.construct(zxing.task, [
		bytes,
		size(),
		size(),
		size(),
		java.construct(zxing.rect, [javaInt(0), javaInt(0), javaInt(width), javaInt(height)]),
		javaInt(0),
		{ type: 'boolean', value: false },
	]);
	const reader = newReader(java, zxing.reader);
	let result: NativeJavaReference | null;

	try {
		result = javaReference(java.invoke(task, zxing.decode, [reader]));
	} catch {
		return undefined;
	}

	return result ? javaText(java.getField(result, zxing.text)) : undefined;
}

export default scanOnAndroid;
