import type { NativeBridge, NativeJavaReference, NativeJavaValue } from '@unbound-app/api/native';
import { javaReference } from '@unbound-plugins/shared/native/android/java-values';

import type { Frame, FrameOptions, FrameReader } from '../frame-reader';
import { cropRect, outputSize } from '../frame-size';

const OPTION_CLOSEST = 3;
const KEY_DURATION = 9;
const KEY_WIDTH = 18;
const KEY_HEIGHT = 19;
const KEY_ROTATION = 24;
const ANTI_ALIAS = 1;

type Java = NativeBridge['java'];

const string = (value: string): NativeJavaValue => ({ type: 'string', value });
const int = (value: number): NativeJavaValue => ({
	type: 'int',
	value: Math.round(value),
});
const float = (value: number): NativeJavaValue => ({ type: 'float', value });
const long = (value: number): NativeJavaValue => ({
	type: 'long',
	value: Math.round(value),
});
const bool = (value: boolean): NativeJavaValue => ({ type: 'boolean', value });

function numberOf(value: unknown): number {
	const read = (value as { value?: unknown } | null)?.value ?? value;

	return Number(read) || 0;
}

function textOf(value: unknown): string {
	const read = (value as { value?: unknown } | null)?.value ?? value;

	return typeof read === 'string' ? read : '';
}

function drawCaption(
	java: Java,
	bitmap: NativeJavaReference,
	caption: string,
	width: number,
	height: number,
) {
	const canvas = java.construct('android.graphics.Canvas', [bitmap]);
	const paint = java.construct('android.graphics.Paint', [int(ANTI_ALIAS)]);
	const size = Math.max(14, Math.round(width / 12));
	const Align = java.getClass('android.graphics.Paint$Align');
	const Style = java.getClass('android.graphics.Paint$Style');
	const Typeface = java.getClass('android.graphics.Typeface');

	java.invoke(paint, 'setTextSize', [float(size)]);
	java.invoke(paint, 'setTypeface', [javaReference(java.getField(Typeface, 'DEFAULT_BOLD'))!]);
	java.invoke(paint, 'setTextAlign', [javaReference(java.getField(Align, 'CENTER'))!]);

	const x = float(width / 2);
	const y = float(height - size * 0.5);

	java.invoke(paint, 'setStyle', [javaReference(java.getField(Style, 'STROKE'))!]);
	java.invoke(paint, 'setStrokeWidth', [float(Math.max(3, size / 6))]);
	java.invoke(paint, 'setColor', [int(0xff000000 | 0)]);
	java.invoke(canvas, 'drawText', [string(caption), x, y, paint]);
	java.invoke(paint, 'setStyle', [javaReference(java.getField(Style, 'FILL'))!]);
	java.invoke(paint, 'setColor', [int(0xffffffff | 0)]);
	java.invoke(canvas, 'drawText', [string(caption), x, y, paint]);
}

/**
 * @description Reads video frames on Android with `MediaMetadataRetriever`, crops and scales them as bitmaps, draws
 * the caption with a `Canvas`, and copies their RGBA bytes out.
 * @param native The plugin's native bridge.
 * @param path The video's absolute path.
 * @returns The reader, or `undefined` when the video can't be opened.
 */
export function createFrameReader({ java }: NativeBridge, path: string): FrameReader | undefined {
	const retriever = java.construct('android.media.MediaMetadataRetriever', []);

	java.invoke(retriever, 'setDataSource', [string(path)]);

	const meta = (key: number) => textOf(java.invoke(retriever, 'extractMetadata', [int(key)]));
	const rotated = [90, 270].includes(Number(meta(KEY_ROTATION)));
	const sourceWidth = Number(meta(rotated ? KEY_HEIGHT : KEY_WIDTH));
	const sourceHeight = Number(meta(rotated ? KEY_WIDTH : KEY_HEIGHT));
	const ARGB_8888 = javaReference(
		java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888'),
	)!;
	const Bitmap = java.getClass('android.graphics.Bitmap');

	if (!sourceWidth || !sourceHeight) {
		java.invoke(retriever, 'release', []);

		return undefined;
	}

	return {
		duration() {
			return Number(meta(KEY_DURATION)) / 1000;
		},
		frame(seconds: number, { width, crop, caption }: FrameOptions): Frame | undefined {
			const rect = cropRect(sourceWidth, sourceHeight, crop);
			const size = outputSize(rect, width);
			const scale = size.width / rect.width;
			const decoded = javaReference(
				java.invoke(retriever, 'getScaledFrameAtTime', [
					long(seconds * 1_000_000),
					int(OPTION_CLOSEST),
					int(sourceWidth * scale),
					int(sourceHeight * scale),
				]),
			);

			if (!decoded) return undefined;

			const full = javaReference(java.invoke(decoded, 'copy', [ARGB_8888, bool(false)]))!;
			const left = Math.min(
				Math.round(rect.x * scale),
				numberOf(java.invoke(full, 'getWidth', [])) - size.width,
			);
			const top = Math.min(
				Math.round(rect.y * scale),
				numberOf(java.invoke(full, 'getHeight', [])) - size.height,
			);
			const croppedBitmap = javaReference(
				java.invoke(Bitmap, 'createBitmap', [
					full,
					int(Math.max(0, left)),
					int(Math.max(0, top)),
					int(size.width),
					int(size.height),
				]),
			)!;
			const frame = javaReference(
				java.invoke(croppedBitmap, 'copy', [ARGB_8888, bool(true)]),
			)!;

			if (caption) drawCaption(java, frame, caption, size.width, size.height);

			const buffer = javaReference(
				java.invoke(java.getClass('java.nio.ByteBuffer'), 'allocate', [
					int(size.width * size.height * 4),
				]),
			)!;

			java.invoke(frame, 'copyPixelsToBuffer', [buffer]);

			const rgba = java.bytes(javaReference(java.invoke(buffer, 'array', []))!);

			for (const bitmap of [decoded, full, croppedBitmap, frame])
				java.invoke(bitmap, 'recycle', []);

			return { ...size, rgba };
		},
		close() {
			java.invoke(retriever, 'release', []);
		},
	};
}

export default { createFrameReader };
